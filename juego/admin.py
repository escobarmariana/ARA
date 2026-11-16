from django.contrib import admin

from .models import Puntuacion


@admin.register(Puntuacion)
class PuntuacionAdmin(admin.ModelAdmin):
    list_display = ("jugador", "productos", "gano", "fecha")
    list_filter = ("gano",)
    search_fields = ("jugador",)
