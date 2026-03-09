from flask import Blueprint, request, jsonify
from services.ml_service import get_traffic_capture, run_ela_tampering, run_rs_analysis

ml_bp = Blueprint("ml", __name__)

@ml_bp.route("/api/ml/params", methods=["GET", "POST"])
def api_ml_params():
    traffic = get_traffic_capture()
    if not traffic:
        return jsonify({"error": "Traffic analyzer not available"}), 503
        
    if request.method == "POST":
        data = request.get_json() or {}
        contam = float(data.get("contamination", 0.1))
        n_est = int(data.get("n_estimators", 100))
        traffic.detector.update_params(contamination=contam, n_estimators=n_est)
        return jsonify({"status": "ok", "message": "Parameters updated"})
    
    return jsonify(traffic.detector.get_metrics())

@ml_bp.route("/api/ml/pcap", methods=["POST"])
def api_ml_pcap():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and file.filename.endswith('.pcap'):
        import os
        from routes.stego_routes import UPLOAD_FOLDER
        from ml_traffic_analyzer import detect_from_pcap
        
        path = os.path.join(UPLOAD_FOLDER, "temp_" + file.filename)
        file.save(path)
        try:
            report = detect_from_pcap(path)
            if report is None:
                return jsonify({"error": "Analysis failed to produce a report"}), 500
            return jsonify(report)
        except Exception as e:
            return jsonify({"error": f"Analysis failed: {str(e)}"}), 500
        finally:
            if os.path.exists(path):
                os.remove(path)
    
    return jsonify({"error": "Invalid file type. Only .pcap allowed"}), 400

@ml_bp.route("/api/ml/traffic", methods=["GET"])
def api_ml_traffic():
    traffic = get_traffic_capture()
    if not traffic:
        return jsonify({"error": "Traffic analyzer not available"}), 503
    try:
        attack = request.args.get("simulate")
        if attack:
            if attack == "portscan":
                for i in range(200):
                    traffic.add_packet(f"10.0.0.{i%255}", "192.168.1.1", 1000 + i, 80 + (i % 300), "TCP", 64)
            elif attack == "ddos":
                for i in range(300):
                    traffic.add_packet(f"10.{i%255}.{i%100}.{i%50}", "192.168.1.1", 80, 80, "TCP", 64)
            elif attack == "exfil":
                for i in range(50):
                    traffic.add_packet("192.168.1.10", "8.8.8.8", 5000, 443, "TCP", 50000)
            elif attack == "reset":
                traffic.detector.reset()

        report = traffic.get_report()
        if isinstance(report, dict) and report.get("error"):
            return jsonify(report)

        window = (report or {}).get("window_analysis") or {}
        features = window.get("features") or {}
        alerts = window.get("alerts") or []
        anomaly = bool(window.get("anomaly") or report.get("anomaly_detected"))
        top_conns = report.get("connection_stats") or []

        ui_payload = {
            "timestamp": report.get("timestamp"),
            "total_packets": report.get("total_packets", 0),
            "features": features,
            "alerts": alerts,
            "anomaly": anomaly,
            "top_connections": top_conns,
        }
        return jsonify(ui_payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@ml_bp.route("/api/ml/tampering", methods=["POST"])
def api_ml_tampering():
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "image file required"}), 400
    try:
        result = run_ela_tampering(file.read())
        return jsonify(result)
    except Exception as e:
        if str(e) == "Tampering model not available":
            return jsonify({"error": str(e)}), 503
        return jsonify({"error": str(e)}), 500

@ml_bp.route("/api/ml/rs-analysis", methods=["POST"])
def api_ml_rs_analysis():
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "image file required"}), 400
    try:
        result = run_rs_analysis(file.read())
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500