from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/guardar/", views.guardar, name="guardar"),
    path("api/ranking/", views.ranking, name="ranking"),
]
