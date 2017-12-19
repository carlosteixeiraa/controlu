// Chama a função a cada 2 minuto.
function recarregar() {
    setInterval(tempo, 1200000)
}

// Quando passa 2 minutos recarrega a pagina.
function tempo() {
    location.reload(); 
}
