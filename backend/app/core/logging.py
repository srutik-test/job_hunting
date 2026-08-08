"""
Platform logging setup.
"""

import logging
import sys

_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"


def setup_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    if root.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FORMAT))
    root.addHandler(handler)
    root.setLevel(level)


setup_logging()
logger = logging.getLogger("platform")
