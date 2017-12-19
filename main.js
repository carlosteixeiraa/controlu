var express = require("express");
var mongoose = require("mongoose");
var session = require("express-session");
var linuxDistro = require('linux-distro');
var procStats = require('process-stats')
var publicIp = require('public-ip');
var os = require('os');
var pty = require('pty.js');
var osName = require('os-name');
var http = require('http');
var fs = require('fs');
var app = express();
var port = 3002;

// Ficheiros estaticos
app.use(express.static('views'));

// Autorizar scripts em node_modules
app.use('/scripts', express.static(__dirname + '/node_modules/'));

// Usar express-session
app.use(session({
    secret: 'f4h8a44f5sdg448',
    resave: false,
    saveUninitialized: true
}));

// Definir tipo de view para pug
app.set('view engine', 'pug');

// Mongoose 
mongoose.connect('mongodb://localhost:27017/controlu', (err) => {
    if(err) {
        console.log('Algo occoreu ao conectar a base de dados!')
    } else {
        console.log('Conectamos a base de dados com sucesso!')
    }
});

// Autenticação
var userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true
    },
    password: { 
        type: String 
    },
    nome: { 
        type: String
    }
});

var User = mongoose.model('usuarios', userSchema);

// Socket.io

var server = http.createServer(app);
var io = require('socket.io').listen(server);
server.listen(port, () => {
    console.log('Controlu a ouvir em localhost:' + port)
});

io.on('connection', function(socket){
  // Criar consola
  var term = pty.spawn('sh', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });
  // Ouve pelo ouput e manda ao user
  term.on('data', function(data){
    socket.emit('output', data);
  });

  // Ouve o que o user insere e manda para a consola
  socket.on('input', function(data){
    term.write(data);
  });

  socket.on('resize', function(data){
    term.resize(data[0], data[1]);
  });

  // Quando o usuario sai
  socket.on("disconnect", function(){
    term.destroy();
    console.log("User saiu da consola!");
  });
});


// API Registro
app.get('/criarconta', (req, res) => {
    var username = req.query.username;
    var password = req.query.password;
    var nome = req.query.nome;

    var salvarUser = new User();
    salvarUser.username = username;
    salvarUser.password = password;
    salvarUser.nome = nome;
    
    salvarUser.save((err, savedUser) => {
        if (err) {
            console.log(err);
        } else {
            console.log('User criado com sucesso!');
            res.redirect('/');
        }
    })
})

// API Login
var erro;
app.get('/login', (req, res) => {
    var username = req.query.username;
    var password = req.query.password;

    User.findOne({
        username: username,
        password: password
    },(err, user) => {
        if (err) {
            console.log(err);
        }
        if (!user) {
            erro = '✖ Utilizador não encontrado ou password errada.';
            res.redirect('/');
        } else {
            erro = '';
            req.session.user = user;
            res.redirect('/painel');
        }
    })
})

// API Logout
app.get('/logout', (req, res) => {
    req.session.user = '';
    res.redirect('/');
});

// Route Inicio
app.get("/", (req, res) => {
    obterInfo();
    if(!req.session.user) {
        res.render('index', {
            titulo: 'Controlu - Iniciar sessão',
            erro: erro
        })
    } else {
        res.redirect('/painel');
    }
});

app.get("/consola", (req, res) => {
    if(!req.session.user) {
        erro = '✖ É necessario iniciar sessão para usar a consola.'        
        res.redirect('/');
    } else {
        erro = '';              
        res.render('consola', {
            titulo: 'Controlu - Consola',
            user: req.session.user.nome
        });
    }
})

// Painel Info
var distro;
var ipp;
var uptime;

function obterInfo() {
    linuxDistro().then(data => {
        distro = data.os;
    });
    publicIp.v4().then(ip => {
        ipp = ip;
    });
    stats = procStats();
}

// Route Painel
app.get("/painel", (req, res) => {
    if(!req.session.user) {
        erro = '✖ É necessario iniciar sessão para usar o painel.'        
        res.redirect('/');
    } else {
        erro = '';        
        obterInfo();
        var sistema = osName();        
        res.render('painel', {
            titulo: 'Controlu - Painel',
            user: req.session.user.nome,
            sistema: sistema,
            uptime: stats.uptime.pretty,
            distro: distro,
            ipp: ipp
        });
    }
});

// Route 404
app.get("*", (req, res) => {
    res.redirect('/');
    console.log('Erro 404 - ', req.path)
})