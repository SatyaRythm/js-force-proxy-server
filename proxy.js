import request from 'request';
import debug from 'debug';

/**
 * Allowed request headers 
 */
var ALLOWED_HEADERS = [
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

/**
 * Endpoint URL validation
 */
var SF_ENDPOINT_REGEXP =
  /^https:\/\/[a-zA-Z0-9\.\-]+\.(force|salesforce|cloudforce|database)\.com\//;

/**
 * Create middleware to proxy request to salesforce server
 */
export default function(options) {
  options = options || {}
  var proxyCounter = 0;

  return function(req, res) {
    if (options.enableCORS) {
      res.header('Access-Control-Allow-Origin', options.allowedOrigin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE');
      res.header('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(','));
      res.header('Access-Control-Expose-Headers', 'SForce-Limit-Info');
      if (req.method === 'OPTIONS') {
        res.end();
        return;
      }
    }
    var sfEndpoint = req.headers["salesforceproxy-endpoint"];
    if (!sfEndpoint) {
      sfEndpoint = req.headers["salesforceproxy-endpoint".toLowerCase()];
    }
    
    if (!sfEndpoint || !SF_ENDPOINT_REGEXP.test(sfEndpoint)) {
      res.status(400).send("Proxying endpoint is not allowed. `salesforceproxy-endpoint` header must be a valid Salesforce domain: " + sfEndpoint);
      return;
    }
    
    // Copy allowed headers
    var headers = {};
    ALLOWED_HEADERS.forEach(function(header) {
      const headerLower = header.toLowerCase();
      // Check for headers in a case-insensitive way
      const foundHeader = Object.keys(req.headers).find(h => h.toLowerCase() === headerLower);
      if (foundHeader) {
        const value = req.headers[foundHeader];
        if (value) {
          const name = headerLower === 'x-authorization' ? 'authorization' : headerLower;
          headers[name] = value;
        }
      }
    });
    
    // Prepare request parameters
    var params = {
      url: sfEndpoint,
      method: req.method,
      headers: headers
    };
    
    // Handle request body for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      if (headers['content-type'] && headers['content-type'].includes('application/json')) {
        params.json = req.body;
      } else {
        params.body = req.body;
      }
    }
    
    console.log('Forwarding request to Salesforce:', {
      method: params.method,
      url: params.url,
      headers: params.headers,
      body: req.body
    });
    
    proxyCounter++;
    console.log("(++req++) " + new Array(proxyCounter+1).join('*'));
    console.log("method=" + params.method + ", url=" + params.url);
    
    // Use request to proxy the request to Salesforce
    request(params, (error, response, body) => {
      if (error) {
        console.error('Salesforce request error:', error);
        proxyCounter--;
        return res.status(500).json({
          error: 'Error connecting to Salesforce',
          details: error.message
        });
      }
      
      console.log('Salesforce response:', {
        statusCode: response.statusCode,
        headers: response.headers,
        body: body
      });
      
      // Copy response headers
      Object.keys(response.headers).forEach(header => {
        res.setHeader(header, response.headers[header]);
      });
      
      // Send response status and body
      res.status(response.statusCode);
      
      // If the response is JSON, parse it and send as JSON
      if (response.headers['content-type'] && 
          response.headers['content-type'].includes('application/json')) {
        try {
          const jsonBody = typeof body === 'string' ? JSON.parse(body) : body;
          proxyCounter--;
          return res.json(jsonBody);
        } catch (e) {
          console.error('Error parsing JSON response:', e);
          proxyCounter--;
          return res.send(body);
        }
      }
      
      // Otherwise send as text
      proxyCounter--;
      res.send(body);
    });
  }
}