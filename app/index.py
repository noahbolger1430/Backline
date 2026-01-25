import os
import sys
import types

# Get the absolute path of the directory containing index.py (the 'app' directory)
app_dir = os.path.dirname(os.path.abspath(__file__))

# Add the current directory to sys.path
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# SHIM: If 'app' is not findable as a package (common when Vercel root is '/app'),
# we create a virtual 'app' module that points to this directory.
try:
    import app
except ImportError:
    # Create a dummy 'app' module
    app_shim = types.ModuleType('app')
    app_shim.__path__ = [app_dir]
    sys.modules['app'] = app_shim
    
    # Optional: ensure __init__.py logic is executed if necessary
    # (Usually not needed for simple FastAPI structures)

# Now these imports will work in both environments
from app.main import app
