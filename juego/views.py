import json

from django.db import connection
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

from .models import Puntuacion

MAX_PRODUCTOS = 30  # productos que hay en el nivel (POSICIONES_PRODUCTOS en juego.js)


def index(request):
    return render(request, "juego/index.html")


@require_POST
def guardar(request):
    """Recibe {jugador, productos, gano} en JSON y lo guarda (INSERT) mediante el ORM."""
    try:
        datos = json.loads(request.body)
        productos = int(datos.get("productos", 0))
    except (ValueError, TypeError, AttributeError):
        return JsonResponse({"error": "Datos inválidos"}, status=400)

    p = Puntuacion.objects.create(
        jugador=(str(datos.get("jugador") or "").strip() or "Anónimo")[:30],
        productos=max(0, min(productos, MAX_PRODUCTOS)),
        gano=bool(datos.get("gano")),
    )
    return JsonResponse({"id": p.id}, status=201)


@require_GET
def ranking(request):
    """Devuelve el top 5 con una consulta SQL escrita a mano (equivale a Puntuacion.objects[:5])."""
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT jugador, productos, gano
            FROM juego_puntuacion
            ORDER BY productos DESC, gano DESC, fecha ASC
            LIMIT 5
            """
        )
        filas = [{"jugador": j, "productos": p, "gano": bool(g)} for j, p, g in cur.fetchall()]
    return JsonResponse(filas, safe=False)
