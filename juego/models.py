from django.db import models


class Puntuacion(models.Model):
    """Una partida terminada. Django la convierte en la tabla SQL `juego_puntuacion`."""
    jugador = models.CharField(max_length=30)
    productos = models.PositiveIntegerField()          # productos recogidos
    gano = models.BooleanField(default=False)          # ¿llegó a la bandera?
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-productos", "-gano", "fecha"]
        verbose_name_plural = "puntuaciones"

    def __str__(self):
        return f"{self.jugador}: {self.productos}"
