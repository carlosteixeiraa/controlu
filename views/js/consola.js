  var socket = io.connect('http://localhost:3002');
  
  socket.on('output', function (data) {
        data = data.replace("\n", "<br>");
        data = data.replace("\r", "<br>");
        $('.consola').append(data);
    });
  
    $(document).on("keypress",function(e){
      var char = "";
      char = String.fromCharCode(e.which);
  
      socket.emit("input", char);
    });