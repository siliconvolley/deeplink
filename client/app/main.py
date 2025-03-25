from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


@app.get("/{name}")
async def welcome_user(request: Request, name: str):
    return templates.TemplateResponse(
        request=request, name="index.html", context={"username": name}
    )