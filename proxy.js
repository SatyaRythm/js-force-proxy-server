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
    
    var params = {
      url: sfEndpoint || "https://login.salesforce.com//services/oauth2/token",
      method: req.method,
      headers: headers
    };
    
    // Special handling for different content types
    var contentType = headers['content-type'] || '';
    
    // For SOAP requests (login)
    if (contentType.includes('text/xml') || contentType.includes('application/soap+xml')) {
      // For SOAP/XML requests, use raw body data
      console.log('Handling SOAP/XML request');
      // Don't set params.json as it will stringify the body
    } 
    // For JSON requests (Apex REST)
    else if (req.method === 'POST' && req.body && contentType.includes('application/json')) {
      console.log('Handling JSON request');
      params.json = req.body;
    }
    
    console.log('Proxy params:', params);
    
    proxyCounter++;
    console.log("(++req++) " + new Array(proxyCounter+1).join('*'));
    console.log("method=" + params.method + ", url=" + params.url);
    
    // Use pipe for streaming the request and response
    req.pipe(request(params))
      .on('response', function(response) {
        console.log('Salesforce response status:', response.statusCode);
        proxyCounter--;
        console.log("(--res--) " + new Array(proxyCounter+1).join('*'));
      })
      .on('error', function(error) {
        console.error('Salesforce request error:', error);
        proxyCounter--;
        console.log("(--err--) " + new Array(proxyCounter+1).join('*'));
      })
      .pipe(res);
  }
}