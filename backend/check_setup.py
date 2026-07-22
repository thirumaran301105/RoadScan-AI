"""
Setup Checker
---------------
Run this BEFORE starting the server:

    cd backend
    python3 check_setup.py

It checks everything the backend needs, one piece at a time, with a clear
pass/fail message for each - instead of you having to decode a Python
traceback to figure out which of a dozen things went wrong.
"""
import sys
import os

CHECK_MARK = "\u2713"
CROSS_MARK = "\u2717"

passed = []
failed = []


def check(label, fn):
    try:
        detail = fn()
        print(f"  {CHECK_MARK} {label}" + (f" ({detail})" if detail else ""))
        passed.append(label)
    except Exception as e:
        print(f"  {CROSS_MARK} {label}")
        print(f"      -> {e}")
        failed.append((label, str(e)))


def check_python_version():
    major, minor = sys.version_info[0], sys.version_info[1]
    if major != 3 or minor < 9 or minor > 12:
        raise RuntimeError(
            f"Python {major}.{minor} detected - this project is tested on Python 3.9-3.12. "
            f"A very new or very old Python version is a common cause of pip install failures "
            f"for packages like opencv/ultralytics/numpy, which don't always have prebuilt "
            f"wheels for the newest Python release yet."
        )
    return f"Python {major}.{minor}"


def check_import(module_name, pip_name=None):
    def _check():
        __import__(module_name)
        mod = sys.modules[module_name]
        version = getattr(mod, "__version__", "unknown")
        return f"v{version}"
    return _check


def check_pip_name(module_name, pip_name):
    def _check():
        try:
            __import__(module_name)
        except ImportError:
            raise RuntimeError(f"Not installed - run: pip install {pip_name} --break-system-packages")
    return _check


def check_model_file():
    model_path = os.path.join("..", "models", "pothole_yolov8_seg.pt")
    if not os.path.exists(model_path):
        raise RuntimeError(
            f"Model file not found at {os.path.abspath(model_path)}. "
            f"Make sure you're running this from inside the backend/ folder, "
            f"and that the models/ folder from the zip wasn't left behind."
        )
    size_mb = os.path.getsize(model_path) / (1024 * 1024)
    if size_mb < 1:
        raise RuntimeError(f"Model file exists but is only {size_mb:.2f}MB - likely corrupted/incomplete.")
    return f"{size_mb:.1f}MB"


def check_model_loads():
    from ultralytics import YOLO
    model = YOLO(os.path.join("..", "models", "pothole_yolov8_seg.pt"))
    return f"classes: {list(model.names.values())}"


def check_frontend_build():
    dist_path = os.path.join("..", "frontend-react", "dist", "index.html")
    if not os.path.exists(dist_path):
        raise RuntimeError(
            "frontend-react/dist not found - the backend will fall back to the older plain-HTML "
            "dashboard instead of the full React app. Run: cd ../frontend-react && npm install && npm run build"
        )
    return "React build found"


def check_database():
    import database
    database.init_db()
    if not os.path.exists(database.DB_PATH):
        raise RuntimeError(f"Database file was not created at {database.DB_PATH}")
    return f"SQLite ready at {os.path.abspath(database.DB_PATH)}"


print("\n=== Checking Python version ===")
check("Python version compatible", check_python_version)

print("\n=== Checking required packages ===")
check("fastapi installed", check_import("fastapi"))
check("uvicorn installed", check_import("uvicorn"))
check("cv2 (opencv) installed", check_import("cv2"))
check("numpy installed", check_import("numpy"))
check("pandas installed", check_import("pandas"))
check("PIL (Pillow) installed", check_import("PIL"))
check("pydantic installed", check_import("pydantic"))
check("requests installed", check_import("requests"))
check("dill installed (required by the bundled model)", check_import("dill"))
check("ultralytics installed", check_import("ultralytics"))

print("\n=== Checking the pothole detection model ===")
check("Model file present", check_model_file)
check("Model actually loads", check_model_loads)

print("\n=== Checking the frontend ===")
check("React dashboard built", check_frontend_build)

print("\n=== Checking persistent storage ===")
check("Database initializes correctly", check_database)

print("\n" + "=" * 60)
if failed:
    print(f"RESULT: {len(failed)} check(s) failed, {len(passed)} passed.\n")
    print("Fix the items marked with \u2717 above, in order, then run this script again.")
    print("If you're stuck, copy the exact error text above when asking for help -")
    print("that's the single most useful thing to share.")
    sys.exit(1)
else:
    print(f"RESULT: All {len(passed)} checks passed! You're ready to run:")
    print("\n    uvicorn main:app --host 0.0.0.0 --port 8000 --reload\n")
    sys.exit(0)
