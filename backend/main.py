# Backend starter fil
# Avkommentera och installera valt ramverk i requirements.txt

# Flask exempel:
# from flask import Flask, jsonify
# from flask_cors import CORS
#
# app = Flask(__name__)
# CORS(app)
#
# @app.route('/api/hello')
# def hello():
#     return jsonify({'message': 'Hello from Python backend'})
#
# if __name__ == '__main__':
#     app.run(debug=True, port=5000)

# FastAPI exempel:
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
#
# app = FastAPI()
#
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
#
# @app.get("/api/hello")
# def read_root():
#     return {"message": "Hello from Python backend"}
#
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=5000)
