import http from 'http';
import express from 'express';
import jsforceAjaxProxy from 'jsforce-ajax-proxy';
 
var app = express();

app.set('port', process.env.PORT || 3123);

// app.use(express.errorHandler());

app.all('/proxy', jsforceAjaxProxy({ enableCORS: true }));

app.get('/', function(req, res) {
  res.send('JSforce AJAX Proxy');
});

http.createServer(app).listen(app.get('port'), function () {
  console.log("Express server listening on port " + app.get('port'));
});