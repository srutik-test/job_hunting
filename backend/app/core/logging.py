"""
Structured logging module with live streaming and job-specific log buffering.
"""

import logging
import sys
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from collections import deque
import json

# Global in-memory log buffer per job (capped at 500 lines per job)
_JOB_LOGS: Dict[str, deque] = {}
_MAX_LOGS_PER_JOB = 500


class JobLogEntry:
    """Structured representation of a single log message."""

    def __init__(
        self,
        job_id: str,
        level: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.job_id = job_id
        self.level = level
        self.message = message
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "level": self.level,
            "message": self.message,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


def add_job_log(
    job_id: str, level: str, message: str, metadata: Optional[Dict[str, Any]] = None
) -> JobLogEntry:
    """Record a structured log message for a specific job."""
    if job_id not in _JOB_LOGS:
        _JOB_LOGS[job_id] = deque(maxlen=_MAX_LOGS_PER_JOB)

    entry = JobLogEntry(
        job_id=job_id, level=level.upper(), message=message, metadata=metadata
    )
    _JOB_LOGS[job_id].append(entry)

    # Also forward to python root logger
    logger = logging.getLogger("hr_extractor")
    log_func = getattr(logger, level.lower(), logger.info)
    log_func(f"[{job_id[:8]}] {message}")

    return entry


def get_job_logs(
    job_id: str, limit: int = 200, since_timestamp: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve logs for a job, optionally filtered by timestamp."""
    if job_id not in _JOB_LOGS:
        return []

    logs = list(_JOB_LOGS[job_id])
    if since_timestamp:
        logs = [log for log in logs if log.timestamp > since_timestamp]

    return [log.to_dict() for log in logs[-limit:]]


def clear_job_logs(job_id: str) -> None:
    """Clear logs for a completed/discarded job."""
    if job_id in _JOB_LOGS:
        del _JOB_LOGS[job_id]


# Configure root console logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("hr_extractor")
