import http from 'http';
import express from 'express';
import jsforceAjaxProxy from 'jsforce-ajax-proxy';
import cors from "cors";
 
const app = express();

// Define CORS options
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.use(express.json());
app.set('port', process.env.PORT || 8090);

// Handle OPTIONS requests explicitly
app.options('/proxy', cors(corsOptions));

// JSforce AJAX Proxy route with CORS enabled
app.all('/proxy', cors(corsOptions), jsforceAjaxProxy({ enableCORS: true }));

app.get('/', function(req, res) {
  res.send('JSforce AJAX Proxy');
});

app.listen(app.get('port'), () => {
    console.log(`server running on ${app.get('port')}`)
})