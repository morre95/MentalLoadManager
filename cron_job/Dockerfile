FROM curlimages/curl:8.12.1

CMD ["sh", "-lc", "curl -f -sS -X POST \"$TARGET_URL\" -H \"X-Cron-Secret: $WEEKLY_SUMMARY_CRON_SECRET\""]
