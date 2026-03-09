from flask import Blueprint, request, jsonify, send_file
import base64
import os
import io
import uuid
import numpy as np
from crypto.aes import encrypt_message, decrypt_message
from stego import lsb_hide, dct_hide, lsb_extract, dct_extract, create_carrier_image
from services.stego_service import (
    ensure_carrier, CARRIER_DEFAULT, get_pixel_lsb_comparison, 
    get_metrics_for_images, generate_pdf_report,
    simulate_jpeg_compression, simulate_noise_addition
)

stego_bp = Blueprint("stego", __name__)
UPLOAD_FOLDER = "uploads" # Ensure this exists or use current dir

@stego_bp.route("/api/carrier", methods=["GET"])
def api_carrier():
    ensure_carrier()
    return send_file(os.path.abspath(CARRIER_DEFAULT), mimetype="image/png", as_attachment=False)

@stego_bp.route("/api/carrier/create", methods=["POST"])
def api_carrier_create():
    data = request.get_json() or {}
    w = int(data.get("width", 400))
    h = int(data.get("height", 300))
    if w < 50 or h < 50 or w > 2000 or h > 2000:
        return jsonify({"error": "width/height must be 50-2000"}), 400
    ensure_carrier()
    path = CARRIER_DEFAULT
    create_carrier_image(path, width=w, height=h)
    with open(path, "rb") as f:
        buf = io.BytesIO(f.read())
    buf.seek(0)
    return send_file(buf, mimetype="image/png", as_attachment=False)

@stego_bp.route("/api/stego/hide", methods=["POST"])
def api_stego_hide():
    message = (request.form.get("message") or "").strip()
    mode = (request.form.get("mode") or "stego").strip().lower()
    password = (request.form.get("password") or "default-analyze-password")
    if mode not in ("stego", "both"):
        return jsonify({"error": "mode must be stego or both"}), 400
    if not message:
        return jsonify({"error": "message is required"}), 400

    carrier_file = request.files.get("carrier")
    if carrier_file and carrier_file.filename:
        carrier_path = os.path.join(UPLOAD_FOLDER, "carrier_upload.png")
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        carrier_file.save(carrier_path)
        cover_path = carrier_path
    else:
        ensure_carrier()
        cover_path = CARRIER_DEFAULT

    try:
        algorithm = (request.form.get("algorithm") or "lsb").strip().lower()
        if mode == "both":
            payload = encrypt_message(message, password)
        else:
            payload = message.encode("utf-8")

        out_path = f"stego_out_{uuid.uuid4().hex}.png"
        
        if algorithm == "dct":
            dct_hide(cover_path, payload, out_path)
            from stego import get_dct_frequency_comparison
            comp = get_dct_frequency_comparison(cover_path, out_path)
            metrics = get_metrics_for_images(cover_path, out_path, algorithm="dct", payload_length_bytes=len(payload))
        else:
            lsb_hide(cover_path, payload, out_path)
            comp, _ = get_pixel_lsb_comparison(payload, n_pixels=10, carrier_path=cover_path)
            metrics = get_metrics_for_images(cover_path, out_path, algorithm="lsb", payload_length_bytes=len(payload))
        
        with open(out_path, "rb") as f:
            png_bytes = f.read()
            
        b64_img = base64.b64encode(png_bytes).decode('ascii')
        
        # Cleanup
        if os.path.exists(out_path): os.remove(out_path)
            
        res = {
            "image_b64": b64_img,
            "stego_algorithm": algorithm,
            "metrics": metrics
        }
        if algorithm == "dct":
            res["dct_frequency_comparison"] = comp
        else:
            res["pixel_lsb_comparison"] = comp
            
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@stego_bp.route("/api/stego/compare", methods=["POST"])
def api_stego_compare():
    message = (request.form.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    carrier_file = request.files.get("carrier")
    if carrier_file and carrier_file.filename:
        carrier_path = os.path.join(UPLOAD_FOLDER, f"carrier_compare_{uuid.uuid4().hex}.png")
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        carrier_file.save(carrier_path)
        cover_path = carrier_path
    else:
        ensure_carrier()
        cover_path = CARRIER_DEFAULT

    try:
        payload = message.encode("utf-8")
        
        # Run LSB
        out_lsb = f"compare_lsb_out_{uuid.uuid4().hex}.png"
        lsb_hide(cover_path, payload, out_lsb)
        lsb_comp, _ = get_pixel_lsb_comparison(payload, n_pixels=10, carrier_path=cover_path)
        lsb_metrics = get_metrics_for_images(cover_path, out_lsb, algorithm="lsb", payload_length_bytes=len(payload))

        # Run DCT
        out_dct = f"compare_dct_out_{uuid.uuid4().hex}.png"
        dct_hide(cover_path, payload, out_dct)
        from stego import get_dct_frequency_comparison
        dct_comp = get_dct_frequency_comparison(cover_path, out_dct)
        dct_metrics = get_metrics_for_images(cover_path, out_dct, algorithm="dct", payload_length_bytes=len(payload))
        
        # Cleanup
        for p in [out_lsb, out_dct]:
            if os.path.exists(p): os.remove(p)
        if carrier_file and os.path.exists(carrier_path): os.remove(carrier_path)

        return jsonify({
            "lsb": {
                "metrics": lsb_metrics,
                "pixel_lsb_comparison": lsb_comp
            },
            "dct": {
                "metrics": dct_metrics,
                "dct_frequency_comparison": dct_comp
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@stego_bp.route("/api/stego/extract", methods=["POST"])
def api_stego_extract():
    stego_file = request.files.get("stego_image") or request.files.get("file")
    if not stego_file or not stego_file.filename:
        return jsonify({"error": "stego_image file is required"}), 400
    mode = (request.form.get("mode") or "stego").strip().lower()
    algorithm = (request.form.get("algorithm") or "lsb").strip().lower()
    password = (request.form.get("password") or "default-analyze-password")

    tmp_path = f"stego_extract_tmp_{uuid.uuid4().hex}.png"
    try:
        stego_file.save(tmp_path)
        if algorithm == "dct":
            extracted = dct_extract(tmp_path)
        else:
            extracted = lsb_extract(tmp_path)
            
        if mode == "both":
            msg = decrypt_message(extracted, password)
            return jsonify({"message": msg, "mode": "both"})
        return jsonify({
            "message": extracted.decode("utf-8"),
            "mode": "stego"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        if os.path.exists(tmp_path): os.remove(tmp_path)

@stego_bp.route("/api/stego/lsb-preview", methods=["POST"])
def api_stego_lsb_preview():
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    try:
        payload = message.encode("utf-8")
        pixels, _ = get_pixel_lsb_comparison(payload, n_pixels=10)
        return jsonify({"pixels": pixels})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@stego_bp.route("/api/stego/report", methods=["POST"])
def api_stego_report():
    data = request.get_json() or {}
    try:
        pdf_bytes = generate_pdf_report(data)
        buf = io.BytesIO(pdf_bytes)
        return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name="stego_battle_report.pdf")
    except Exception as e:
        return jsonify({"error": str(e)}), 500
