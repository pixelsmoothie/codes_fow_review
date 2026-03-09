import os
import base64
import io

# ML objects
traffic_capture = None
ela_svm = None
ela_scaler = None

def init_ml():
    global traffic_capture, ela_svm, ela_scaler
    
    try:
        from ml_traffic_analyzer import TrafficCapture
        traffic_capture = TrafficCapture()
        print("[ML Service] Traffic analyzer loaded")
    except Exception as e:
        print(f"[ML Service] Traffic analyzer unavailable: {e}")

    try:
        import joblib
        ela_svm = joblib.load("models/ela_svm_model.pkl")
        ela_scaler = joblib.load("models/ela_scaler.pkl")
        print("[ML Service] ELA SVM tampering model loaded")
    except Exception as e:
        print(f"[ML Service] ELA SVM unavailable: {e}")

def get_traffic_capture():
    return traffic_capture

def run_rs_analysis(file_bytes):
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    arr = np.array(img)

    def rs_analyze(channel):
        h, w = channel.shape
        def flip(x): return x ^ 1
        def inv_flip(x): return x ^ 1  # same for LSB

        rm, sm, rm_neg, sm_neg = 0, 0, 0, 0
        total = 0

        for y in range(0, h-1, 2):
            for x in range(0, w-1, 2):
                group = channel[y:y+2, x:x+2].flatten().astype(np.int32)
                if len(group) < 4:
                    continue
                total += 1

                def disc(g):
                    return sum(abs(int(g[i+1]) - int(g[i])) for i in range(len(g)-1))

                d_orig = disc(group)

                flipped = group.copy()
                flipped[1::2] = np.clip(flipped[1::2] + 1, 0, 255)
                d_flip = disc(flipped)

                neg_flipped = group.copy()
                neg_flipped[1::2] = np.clip(neg_flipped[1::2] - 1, 0, 255)
                d_neg = disc(neg_flipped)

                if d_flip > d_orig: rm += 1
                if d_flip < d_orig: sm += 1
                if d_neg > d_orig: rm_neg += 1
                if d_neg < d_orig: sm_neg += 1

        if total == 0:
            return {"rm": 0, "sm": 0, "rm_neg": 0, "sm_neg": 0, "hidden_ratio": 0.0}

        rm_r = rm / total
        sm_r = sm / total
        rm_neg_r = rm_neg / total
        sm_neg_r = sm_neg / total

        try:
            a = 2 * (rm_r - rm_neg_r)
            b = rm_neg_r - rm_r + sm_r - sm_neg_r
            c = sm_neg_r - sm_r
            disc_val = b*b - 4*a*c
            if disc_val >= 0 and a != 0:
                x1 = (-b + disc_val**0.5) / (2*a)
                x2 = (-b - disc_val**0.5) / (2*a)
                ratio = min(x1, x2) if min(x1,x2) > 0 else max(x1, x2)
                ratio = max(0.0, min(1.0, float(ratio)))
            else:
                ratio = 0.0
        except:
            ratio = 0.0

        return {
            "rm": round(rm_r * 100, 2),
            "sm": round(sm_r * 100, 2),
            "rm_neg": round(rm_neg_r * 100, 2),
            "sm_neg": round(sm_neg_r * 100, 2),
            "hidden_ratio": round(ratio * 100, 2)
        }

    r_stats = rs_analyze(arr[:, :, 0])
    g_stats = rs_analyze(arr[:, :, 1])
    b_stats = rs_analyze(arr[:, :, 2])
    max_ratio = max(r_stats["hidden_ratio"], g_stats["hidden_ratio"], b_stats["hidden_ratio"])
    avg_ratio = (r_stats["hidden_ratio"] + g_stats["hidden_ratio"] + b_stats["hidden_ratio"]) / 3.0
    detected = max_ratio > 3.0

    return {
        "verdict": "stego_detected" if detected else "clean",
        "stego_detected": bool(detected),
        "max_hidden_ratio": round(max_ratio, 2),
        "avg_hidden_ratio": round(avg_ratio, 2),
        "channels": {
            "R": r_stats,
            "G": g_stats,
            "B": b_stats
        }
    }

def run_ela_tampering(file_bytes):
    if not ela_svm:
        raise ValueError("Tampering model not available")
        
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

    # Extract ELA features
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    buf.seek(0)
    recompressed = Image.open(buf).convert("RGB")

    arr1 = np.array(img, dtype=np.float32)
    arr2 = np.array(recompressed, dtype=np.float32)
    diff = np.abs(arr1 - arr2)

    features = []
    for ch in range(3):
        channel = diff[:,:,ch]
        features.extend([
            float(np.mean(channel)),
            float(np.std(channel)),
            float(np.max(channel)),
            float(np.percentile(channel, 90)),
            float(np.percentile(channel, 75)),
        ])
    ela_map = np.mean(diff, axis=2)
    block_vars = [
        float(np.var(ela_map[y:y+16, x:x+16]))
        for y in range(0, ela_map.shape[0]-16, 16)
        for x in range(0, ela_map.shape[1]-16, 16)
    ]
    features.extend([
        float(np.mean(ela_map)),
        float(np.std(ela_map)),
        float(np.max(ela_map)),
        float(np.percentile(ela_map, 90)),
        float(np.percentile(ela_map, 75)),
        float(np.mean(block_vars)) if block_vars else 0.0,
    ])

    X = np.array([features])
    X_scaled = ela_scaler.transform(X)
    pred = ela_svm.predict(X_scaled)[0]
    proba = ela_svm.predict_proba(X_scaled)[0]
    confidence = float(proba[pred]) * 100

    ela_norm = (ela_map / max(ela_map.max(), 1e-6) * 255).astype(np.uint8)
    h, w = ela_norm.shape
    heatmap_rgb = np.zeros((h, w, 3), dtype=np.uint8)
    heatmap_rgb[:,:,0] = ela_norm
    heatmap_rgb[:,:,1] = (ela_norm * 0.2).astype(np.uint8)
    heatmap_rgb[:,:,2] = (ela_norm * 0.1).astype(np.uint8)

    heatmap_img = Image.fromarray(heatmap_rgb)
    heatmap_buf = io.BytesIO()
    heatmap_img.save(heatmap_buf, "PNG")
    heatmap_b64 = base64.b64encode(heatmap_buf.getvalue()).decode("ascii")

    orig_buf = io.BytesIO()
    img.save(orig_buf, "PNG")
    orig_b64 = base64.b64encode(orig_buf.getvalue()).decode("ascii")

    label = "tampered" if pred == 1 else "authentic"
    return {
        "verdict": label.upper(),
        "tampered": bool(pred == 1),
        "confidence": round(confidence, 1),
        "features": {
            "mean_ela": round(features[0], 3),
            "max_ela": round(features[2], 3),
            "std_ela": round(features[1], 3),
        },
        "heatmap_b64": heatmap_b64,
        "original_b64": orig_b64,
    }