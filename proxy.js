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
    if (!SF_ENDPOINT_REGEXP.test(sfEndpoint)) {
      res.status(400).send("Proxying endpoint is not allowed. `salesforceproxy-endpoint` header must be a valid Salesforce domain: " + sfEndpoint);
      return;
    }
    
    var headers = {};
    ALLOWED_HEADERS.forEach(function(header) {
      header = header.toLowerCase();
      var value = req.headers[header]
      if (value) {
        var name = header === 'x-authorization' ? 'authorization' : header;
        headers[name] = req.headers[header];
      }
    });
    
    var contentType = headers['content-type'] || '';
    console.log('Content-Type:', contentType);
    
    // Different handling based on content type
    if (contentType.includes('text/xml') || contentType.includes('application/soap+xml')) {
      // For SOAP/XML requests (login) - use streaming approach
      console.log('Handling SOAP/XML request with streaming');
      
      var params = {
        url: sfEndpoint,
        method: req.method,
        headers: headers
      };
      
      console.log('SOAP request params:', params);
      proxyCounter++;
      console.log("(++req++) " + new Array(proxyCounter+1).join('*'));
      
      // Use pipe for streaming XML/SOAP requests
      req.pipe(request(params))
        .on('response', function(response) {
          console.log('Salesforce SOAP response status:', response.statusCode);
          proxyCounter--;
          console.log("(--res--) " + new Array(proxyCounter+1).join('*'));
        })
        .on('error', function(error) {
          console.error('Salesforce SOAP request error:', error);
          proxyCounter--;
          console.log("(--err--) " + new Array(proxyCounter+1).join('*'));
        })
        .pipe(res);
    } 
    else {
      // For JSON requests (Apex REST) - use non-streaming approach
      console.log('Handling JSON/REST request with non-streaming');
      
      var params = {
        url: sfEndpoint,
        method: req.method,
        headers: headers
      };
      
      // Handle request body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        if (contentType.includes('application/json')) {
          params.json = req.body;
        } else {
          params.body = req.body;
        }
      }
      
      console.log('REST request params:', params);
      proxyCounter++;
      console.log("(++req++) " + new Array(proxyCounter+1).join('*'));
      
      // Use callback approach for JSON/REST requests
      request(params, function(error, response, body) {
        if (error) {
          console.error('Salesforce REST request error:', error);
          proxyCounter--;
          console.log("(--err--) " + new Array(proxyCounter+1).join('*'));
          return res.status(500).json({
            error: 'Error connecting to Salesforce',
            details: error.message
          });
        }
        
        console.log('Salesforce REST response status:', response.statusCode);
        
        // Copy response headers
        Object.keys(response.headers).forEach(function(header) {
          res.setHeader(header, response.headers[header]);
        });
        
        // Send response with appropriate status
        res.status(response.statusCode);
        
        // Parse and send response body
        if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
          try {
            const jsonBody = typeof body === 'string' ? JSON.parse(body) : body;
            res.json(jsonBody);
          } catch (e) {
            res.send(body);
          }
        } else {
          res.send(body);
        }
        
        proxyCounter--;
        console.log("(--res--) " + new Array(proxyCounter+1).join('*'));
      });
    }
  }
}