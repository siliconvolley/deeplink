import uvicorn
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def index():
    return {'message': 'Welcome to Deeplink!'}

if __name__ == "__main__":
    uvicorn.run(
        "app",
        host="0.0.0.0",
        port=8000,
        debug=True,
        reload=True,
    )
