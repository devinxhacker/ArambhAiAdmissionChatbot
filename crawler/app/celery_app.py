from celery import Celery
from celery.schedules import crontab
from .config import get_settings

s = get_settings()

celery = Celery(
    "arambh_crawler",
    broker=s.celery_broker_url,
    backend=s.celery_result_backend,
    include=["app.tasks"],
)

celery.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_retry_delay=30,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Default beat schedule: run scheduler every 30 minutes
celery.conf.beat_schedule = {
    "tick-every-30-min": {
        "task": "crawler.tasks.tick",
        "schedule": crontab(minute="*/30"),
    },
}
