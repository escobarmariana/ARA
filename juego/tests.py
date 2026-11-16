import json

from django.test import Client, TestCase
from django.urls import reverse

from .models import Puntuacion


def post(client, datos):
    return client.post(reverse("guardar"), json.dumps(datos), content_type="application/json")


class JuegoTests(TestCase):
    def test_index_carga_y_usa_static(self):
        r = self.client.get(reverse("index"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "/static/juego/juego.js")
        self.assertContains(r, reverse("guardar"))

    def test_guardar_y_ranking(self):
        for nombre, n in [("Ana", 12), ("Luis", 30), ("Eva", 3)]:
            self.assertEqual(post(self.client, {"jugador": nombre, "productos": n, "gano": n == 30}).status_code, 201)
        datos = self.client.get(reverse("ranking")).json()
        self.assertEqual([d["jugador"] for d in datos], ["Luis", "Ana", "Eva"])
        self.assertTrue(datos[0]["gano"])

    def test_ranking_limita_a_5(self):
        for i in range(8):
            post(self.client, {"jugador": f"J{i}", "productos": i})
        self.assertEqual(len(self.client.get(reverse("ranking")).json()), 5)

    def test_valida_entrada(self):
        self.assertEqual(self.client.post(reverse("guardar"), "no es json", content_type="application/json").status_code, 400)
        post(self.client, {"jugador": "", "productos": 9999})
        p = Puntuacion.objects.get()
        self.assertEqual((p.jugador, p.productos), ("Anónimo", 30))

    def test_guardar_solo_post(self):
        self.assertEqual(self.client.get(reverse("guardar")).status_code, 405)

    def test_exige_csrf(self):
        r = Client(enforce_csrf_checks=True).post(reverse("guardar"), "{}", content_type="application/json")
        self.assertEqual(r.status_code, 403)
