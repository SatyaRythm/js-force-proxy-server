import http from 'http';
import express from 'express';
import jsforceAjaxProxy from 'jsforce-ajax-proxy';
import cors from "cors";
 
const app = express();

app.use(cors());
app.set('port', process.env.PORT || 8090);

// app.use(express.errorHandler());

app.all('/proxy', jsforceAjaxProxy({ enableCORS: true }));

app.get('/', function(req, res) {
  res.send('JSforce AJAX Proxy');
});

app.listen(app.get('port'), () => {
    console.log(`server running on ${app.get('port')}`)
})