import http from 'http';
import express from 'express';
import jsforceAjaxProxy from './proxy.js';
import cors from "cors";
 
const app = express();

let ALLOWED_HEADERS = [
    'Authorization',
    'Content-Type',
    'Salesforceproxy-Endpoint',
    'X-Authorization',
    'X-SFDC-Session',
    'SOAPAction',
    'Sforce-Auto-Assign',
    'Sforce-Call-Options',
    'Sforce-Query-Options',
    'x-sfdc-packageversion-clientPackage',
    'If-Modified-Since',
    'X-User-Agent'
  ];

// Define CORS options
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ALLOWED_HEADERS,
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Body parser middleware - ensure these are before the proxy route
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.set('port', process.env.PORT || 8090);

// Handle OPTIONS requests explicitly
app.options('/proxy', cors(corsOptions), (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE');
    res.header('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(','));
    res.header('Access-Control-Expose-Headers', 'SForce-Limit-Info');
    res.sendStatus(200);
});

// Debug middleware to log requests
app.use('/proxy', (req, res, next) => {
    console.log('Proxy Request:', {
        method: req.method,
        headers: req.headers,
        body: req.body,
        url: req.url
    });
    next();
});

// JSforce AJAX Proxy route with CORS enabled
app.all('/proxy', cors(corsOptions), jsforceAjaxProxy({ enableCORS: true }));

app.get('/', function(req, res) {
  res.send('JSforce AJAX Proxy');
});

app.listen(app.get('port'), () => {
    console.log(`server running on ${app.get('port')}`)
})