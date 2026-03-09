import os
import io
import base64
import numpy as np
import math
from PIL import Image, ImageDraw
from stego.lsb import hide_in_image as lsb_hide, extract_from_image as lsb_extract, create_carrier_image
from stego.dct import embed_in_image as dct_hide, extract_from_image as dct_extract
from crypto.aes import encrypt_message, decrypt_message
from services.crypto_service import derive_aes_key_from_shared_secret

CARRIER_DEFAULT = "carrier.png"

def ensure_carrier():
    if not os.path.exists(CARRIER_DEFAULT):
        create_carrier_image(CARRIER_DEFAULT)

def get_image_thumbnail_b64(path, size=(200, 200)):
    """Generate a small base64 thumbnail for a given image path."""
    if not os.path.exists(path):
        return ""
    try:
        img = Image.open(path)
        img.thumbnail(size)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except:
        return ""

def calculate_metrics(cover_path, stego_path, payload_bits):
    """Calculate PSNR, MSE, and SSIM between cover and stego images."""
    try:
        c_img = Image.open(cover_path).convert("RGB")
        s_img = Image.open(stego_path).convert("RGB")
        c_arr = np.array(c_img).astype(np.float64)
        s_arr = np.array(s_img).astype(np.float64)
        
        mse = np.mean((c_arr - s_arr) ** 2)
        if mse == 0:
            psnr = 100.0
        else:
            psnr = 20 * math.log10(255.0 / math.sqrt(mse))
            
        # SSIM per channel
        ssim_vals = []
        for ch in range(3):
            c_ch = c_arr[:,:,ch]
            s_ch = s_arr[:,:,ch]
            mu_c = np.mean(c_ch)
            mu_s = np.mean(s_ch)
            var_c = np.var(c_ch)
            var_s = np.var(s_ch)
            cov = np.mean((c_ch - mu_c) * (s_ch - mu_s))
            c1 = (0.01 * 255)**2
            c2 = (0.03 * 255)**2
            ssim_vals.append(((2 * mu_c * mu_s + c1) * (2 * cov + c2)) / ((mu_c**2 + mu_s**2 + c1) * (var_c + var_s + c2)))
        ssim = float(np.mean(ssim_vals))
        
        # Payload Ratio (bpp)
        w, h = c_img.size
        bpp = payload_bits / (w * h)
        
        # Steganalysis: Chi-Square (Compare stego vs cover)
        orig_counts, _ = np.histogram(c_arr, bins=256, range=(0, 256))
        steg_counts, _ = np.histogram(s_arr, bins=256, range=(0, 256))
        orig_counts = orig_counts.astype(np.float64) + 1e-6 
        chi_square = float(np.sum(((steg_counts - orig_counts)**2) / orig_counts))
        
        # Steganalysis: Entropy
        probs = (steg_counts.astype(np.float64) + 1e-7) / np.sum(steg_counts)
        entropy = -np.sum(probs * np.log2(probs))
        
        orig_probs = (orig_counts.astype(np.float64) + 1e-7) / np.sum(orig_counts)
        orig_entropy = -np.sum(orig_probs * np.log2(orig_probs))
        entropy_diff = entropy - orig_entropy

        return {
            "psnr": round(psnr, 2),
            "mse": round(mse, 4),
            "ssim": round(ssim, 4),
            "payload_ratio_bpp": round(bpp, 4),
            "adv_detectability_chi": round(chi_square, 2),
            "adv_detectability_entropy_diff": round(entropy_diff, 6),
            "stego_thumb": get_image_thumbnail_b64(stego_path),
            "stego_full": get_image_thumbnail_b64(stego_path, size=(800, 800))
        }
    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {
            "psnr": 0, "mse": 0, "ssim": 0, "payload_ratio_bpp": 0,
            "adv_detectability_chi": 0, "adv_detectability_entropy_diff": 0,
            "stego_thumb": "", "stego_full": ""
        }

def get_pixel_lsb_comparison(payload, n_pixels=10, carrier_path=None):
    if carrier_path is None:
        ensure_carrier()
        carrier_path = CARRIER_DEFAULT
    
    img = Image.open(carrier_path).convert("RGB")
    pixels = np.array(img)[:n_pixels, 0, :]
    
    # We need to simulate the modification to show comparison
    modified = pixels.copy()
    # Apply direct LSB changes for the first few bits of payload
    bits = []
    for byte in payload[:1]: # Just first byte for visualization
        for i in range(8):
            bits.append((byte >> i) & 1)
    
    idx = 0
    for i in range(len(modified)):
        for j in range(3): # R,G,B
            if idx < len(bits):
                modified[i, j] = (modified[i, j] & 0xFE) | bits[idx]
                idx += 1
                
    data = {
        "original": pixels.tolist(),
        "modified": modified.tolist()
    }
    
    # We also need to return metrics for LSB
    # Since we don't have a full stego image yet in this preview function, 
    # we'll return a stub that the route will later override if needed, 
    # but for /api/stego/hide with LSB mode, the route expects (comp, metrics).
    
    # Need a full stego image for real metrics. Let's create a temp one if we want real metrics.
    # But often get_pixel_lsb_comparison is called during PREVIEW.
    # If called from api_stego_hide, it uses the 'out_path'.
    
    # Let's adjust the routes to handle this better.
    return data, {}

def get_metrics_for_images(cover_path, stego_path, algorithm="lsb", payload_length_bytes=0):
    metrics = calculate_metrics(cover_path, stego_path, payload_length_bytes * 8)
    
    # Robustness simulation
    # JPEG
    jpg_path = simulate_jpeg_compression(stego_path, quality=75)
    cer_jpg = calculate_cer(stego_path, jpg_path, algorithm, payload_length_bytes)
    metrics["adv_compress_cer"] = cer_jpg
    metrics["adv_compress_thumb"] = get_image_thumbnail_b64(jpg_path)
    metrics["adv_compress_full"] = get_image_thumbnail_b64(jpg_path, size=(800, 800))
    if os.path.exists(jpg_path): os.remove(jpg_path)
    
    # Noise
    noisy_path = simulate_noise_addition(stego_path, std_dev=5)
    cer_noise = calculate_cer(stego_path, noisy_path, algorithm, payload_length_bytes)
    metrics["adv_noise_cer"] = cer_noise
    metrics["adv_noise_thumb"] = get_image_thumbnail_b64(noisy_path)
    metrics["adv_noise_full"] = get_image_thumbnail_b64(noisy_path, size=(800, 800))
    if os.path.exists(noisy_path): os.remove(noisy_path)
    
    return metrics

def calculate_cer(orig_stego_path, attacked_path, algorithm, payload_len):
    """Calculate Channel Error Rate between original stego and attacked version."""
    try:
        if algorithm == "dct":
            from stego.dct import extract_raw_bits_from_image as ex
        else:
            from stego.lsb import extract_raw_bits_from_image as ex
        
        num_bits = payload_len * 8
        if num_bits == 0: return 0.0
        
        bits_orig = ex(orig_stego_path, num_bits)
        bits_attacked = ex(attacked_path, num_bits)
        
        errors = 0
        for i in range(min(len(bits_orig), len(bits_attacked))):
            if bits_orig[i] != bits_attacked[i]:
                errors += 1
        
        return round(errors / num_bits, 4)
    except:
        return 0.5 # High error if failed

def generate_pdf_report(data):
    return b"%PDF-1.4 stub"

def simulate_jpeg_compression(path, quality=75):
    img = Image.open(path).convert("RGB")
    out_path = path + ".attack.jpg"
    img.save(out_path, "JPEG", quality=quality)
    return out_path

def simulate_noise_addition(path, std_dev=5):
    img = Image.open(path).convert("RGB")
    arr = np.array(img).astype(np.float32)
    noise = np.random.normal(0, std_dev, arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    out_path = path + ".attack_noisy.png"
    Image.fromarray(arr).save(out_path)
    return out_path

def build_chat_packet(mode, message, sender, recipient, get_shared_secret_func,
                      custom_image_b64=None, multimedia_b64=None, algorithm="lsb", filename=None):
    shared_secret, dh_debug = get_shared_secret_func(sender, recipient)
    if not shared_secret:
        raise ValueError("Shared secret not found for recipients")
    aes_key = derive_aes_key_from_shared_secret(shared_secret)

    packet = {
        "mode": mode, "plaintext": message, "dh_debug": dh_debug,
        "multimedia_b64": multimedia_b64, "filename": filename,
        "algorithm": algorithm,
        "cipher_b64": None, "cipher_hex": None, "stego_b64": None,
    }

    if mode in ("aes", "both"):
        encrypted_payload = encrypt_message(message, aes_key)
        packet["cipher_b64"] = base64.b64encode(encrypted_payload).decode("ascii")
        packet["cipher_hex"] = encrypted_payload.hex()

    if mode in ("stego", "both"):
        if mode == "both":
            payload_to_hide = encrypted_payload
        else:
            payload_to_hide = message.encode("utf-8")

        if custom_image_b64:
            header, encoded = custom_image_b64.split(",", 1) if "," in custom_image_b64 else ("", custom_image_b64)
            cover_bytes = base64.b64decode(encoded)
            cover_img = Image.open(io.BytesIO(cover_bytes))
            cover_path = f"temp_carrier_{sender}_{recipient}.png"
            cover_img.save(cover_path)
        else:
            ensure_carrier()
            cover_path = CARRIER_DEFAULT

        out_path = f"temp_packet_{sender}_{recipient}.png"
        if algorithm == "dct":
            dct_hide(cover_path, payload_to_hide, out_path)
        else:
            lsb_hide(cover_path, payload_to_hide, out_path)

        with open(out_path, "rb") as f:
            packet_bytes = f.read()

        if os.path.exists(out_path): os.remove(out_path)
        if custom_image_b64 and os.path.exists(cover_path): os.remove(cover_path)

        packet["stego_b64"] = base64.b64encode(packet_bytes).decode("ascii")

    return packet