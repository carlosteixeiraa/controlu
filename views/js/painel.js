// Chama a função a cada 1 minuto.
function recarregar() {
    setInterval(tempo, 60000) // 1 minuto
    //setInterval(tempo, 5000) // 5 segundos
}

// Quando passa 2 minutos recarrega a pagina.
function tempo() {
    location.reload(); 
}
