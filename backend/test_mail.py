import resend

resend.api_key = "re_4Y66C8kM_NBv8gKiHueT8h5ooSrcKUZ1J"

params: resend.Emails.SendParams = {
    "from": "mentalloadmanager@morencv.se",
    "to": ["erik.moren78@gmail.com"],
    "subject": "hi",
    "html": "<strong>hello, world!</strong>",
    "reply_to": "erik.moren78@gmail.com",
    "tags": [
        {"name": "tag1", "value": "tagvalue1"},
        {"name": "tag2", "value": "tagvalue2"},
    ],
}

email: resend.Emails.SendResponse = resend.Emails.send(params)
print(email)
