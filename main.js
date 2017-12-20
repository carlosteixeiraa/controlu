var express = require("express");
var mongoose = require("mongoose");
var session = require("express-session");
var linuxDistro = require('linux-distro');
var procStats = require('process-stats')
var publicIp = require('public-ip');
var ip2country = require('ip2country');
var os = require('os');
var pty = require('pty.js');
var osName = require('os-name');
var diskspace = require('diskspace');
var http = require('http');
var fs = require('fs');
var cpu = require('cpu');
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

io.on('connection', (socket) =>{
  // Criar consola
  var term = pty.spawn('sh', [], {
    name: 'xterm-color',
    cols: 90,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });
  // Ouve pelo ouput e manda ao user
  term.on('data', (data) => {
    socket.emit('output', data);
  });

  // Ouve o que o user insere e manda para a consola
  socket.on('input', (data) => {
    term.write(data);
  });

  socket.on('resize', (data) => {
    term.resize(data[0], data[1]);
  });

  // Quando o usuario sai
  socket.on("disconnect", () => {
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
            res.redirect('/');
        } else {
            console.log('User criado com sucesso!');
            mensagem = '✓ User criado com sucesso!'
            res.redirect('/logout');
        }
    })
})

// API Login
var erro;
var mensagem;
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
            mensagem = '';
            res.redirect('/');
        } else {
            erro = '';
            mensagem = '';
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
    obterUsers();
    if(!req.session.user) {
        res.render('index', {
            titulo: 'Controlu - Iniciar sessão',
            erro: erro,
            mensagem: mensagem
        })
    } else {
        res.redirect('/painel');
    }
});

// Route Consola
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

// Obter users
var usuarios;
function obterUsers() {
    User.find(function (err, Users) {
        if (err) {
            console.error(err);
        } else {
            usuarios = Users;
        }
    });
}

// Route Opções
app.get("/opcoes", (req, res) => {
    obterUsers();
    if(!req.session.user) {
        erro ='✖ É necessario iniciar sessão para aceder as opções.';
        res.redirect("/");
    } else {
        erro = '';
        res.render('opcoes', {
            titulo: 'Controlu - Opções',
            user: req.session.user,
            usuarios: usuarios
        })
    }
})

// Mudar Nome
app.get("/mudarnome", (req, res) => {
    if(!req.session.user) {
        erro ='✖ É necessario iniciar sessão para alterar informações.';
        res.redirect("/");
    } else {
        var nomeo = req.query.nome;
        var nomea = req.session.user.nome;
        User.update({
            nome: nomea
        },{
            nome: nomeo,
        }).then(doc => {
            if(!doc) {
                res.redirect("/");
            } else {
                mensagem = '✓ Nome actualizado com sucesso!'
                res.redirect("/logout");
            }
        })
    } 
});

// Mudar Password
app.get("/mudarpass", (req, res) => {
    if(!req.session.user) {
        erro ='✖ É necessario iniciar sessão para alterar informações.';
        res.redirect("/");
    } else {
        var passwordo = req.query.password;
        var nomea = req.session.user.nome;
        User.update({
            nome: nomea
        },{
            password: passwordo,
        }).then(doc => {
            if(!doc) {
                res.redirect("/");
            } else {
                mensagem = '✓ Password actualizada com sucesso!'
                res.redirect("/logout");
            }
        })
    } 
});

// Remover User
app.get("/removeruser", (req, res) => {
    if(!req.session.user) {
        erro ='✖ É necessario iniciar sessão para alterar informações.';
        res.redirect("/");
    } else {
        var nomeo = req.query.usuario
        User.findOneAndRemove({
            nome: nomeo
        }, (err) => {
            if (err) {
                console.log(err);
                res.redirect('/');
            } else {
                mensagem = '✓ User removido com sucesso!';
                res.redirect('/logout');
            }
        })
    }
});

// Painel Info
var distro;
var ipp;
var disco;
var cpuuso;
var cpunum;
var pais;

function obterInfo() {
    // Distro
    linuxDistro().then(data => {
        distro = data.os;
    });
    // IP
    publicIp.v4().then(ip => {
        ipp = ip;
    });
    // Sistema
    stats = procStats();
    // CPU
    cpunum = cpu.num();
    cpu.usage((arr) => {
        cpuuso = arr[0];
    });
    // Pais
    pais = ip2country(ipp);    
}

// Retirar %
function retirarP(nome) {
    nome.substring(0, nome.length - 1)
}

// Calcular %
function calcularP(num1, num2) {
    var pp = 100*num2
    var sp = pp/num1
    return sp;
}

// Prevenir 404 favicon
app.get('/favicon.ico', (req, res) => {
    res.status(204);
});


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
            ramf: stats.memFree.pretty,
            cpuuso: cpuuso,
            cpunum: cpunum,
            pais: pais,
            ramfp: stats.memFree.percent,
            ramt: stats.memTotal.pretty,
            ramtp: stats.memTotal.percent,
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