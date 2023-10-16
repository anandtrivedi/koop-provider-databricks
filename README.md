# Koop Provider Example

[![Build Status](https://travis-ci.org/koopjs/koop-provider-example.svg?branch=master)](https://travis-ci.org/koopjs/koop-provider-example) [![Greenkeeper badge](https://badges.greenkeeper.io/koopjs/koop-provider-example.svg)](https://greenkeeper.io/)


This is an example that demonstrates how to build a Koop Provider. You can clone this project, and use it to start a new provider. This sample can run a local server, deploy to AWS Lambda or Docker for testing and operations. Once the provider is published to NPM, then it can be used with other Koop providers and outputs in a larger project.

The data source in this example is the [TriMet Bus API](https://developer.trimet.org). You can see this provider in action [here](http://dcdev.maps.arcgis.com/home/item.html?id=2603e7e3f10742f78093edf8ea2adfd8#visualize).

Full documentation is provided [here](https://koopjs.github.io/docs/usage/provider).

## Getting started

1. Open `config/default.json` with any configurable parameters
1. Open `src/index.js` and change `provider.name` to a unique name
1. Open `src/model.js` and implement `getData` to call your provider and return GeoJSON
1. Install dependencies `npm install`
1. Run a local dev server `npm start`
1. Add tests to `test/`

## Koop provider file structure

| File | | Description |
| --- | --- | --- |
| `src/index.js` | Mandatory | Configures provider for usage by Koop |
| `src/model.js` | Mandatory | Translates remote API to GeoJSON |
| `src/routes.js` | Optional | Specifies additional routes to be handled by this provider |
| `src/controller.js` | Optional | Handles additional routes specified in `routes.js` |
| `test/model-test.js` | Optional | tests the `getData` function on the model |
| `test/fixtures/input.json` | Optional | a sample of the raw input from the 3rd party API |
| `config/default.json` | Optional | used for advanced configuration, usually API keys. |


## Test it out
Run server:
- `npm install`
- `npm start`
## Run on your own machine
- set .env file. Refer to .evn.example
- modify config\default.json to set other variables
- npm start
- e.g 'curl http://localhost:8080/databricks/rest/services/geoserverat.default.structures_national_gdb/FeatureServer/layers' should work 

Example API Query:
- `curl localhost:8080/example/FeatureServer/0/query?returnCountOnly=true`


Tests:
- `npm test`

### Development output callstack logs

During development you can output error callstack with

- `NODE_ENV=test npm start`

## Publish to npm

- run `npm init` and update the fields
  - Choose a name like `koop-provider-foo`
- run `npm publish`

## For SSL:
 - Install nginx (brew install nginx)
 - Modify the server.conf (/opt/homebrew/etc/nginx/nginx.conf) to incude: 
  server {
    	listen 443 ssl;
    	server_name localhost;
        ssl_session_timeout  5m;

    	ssl_certificate /opt/homebrew/etc/certs/certificate.pem;
    	ssl_certificate_key /opt/homebrew/etc/certs/private_key_without_pass.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384';


    	location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    	}
    }
    - Modify server.conf to comment server directive listening on 8080 as we will let npm handle that. 
    - Errors will be at tail -f /opt/homebrew/var/log/nginx 
    - Restart nginx: brew services restart nginx            
    - Try curl https://localhost/databricks/rest/services/geoserverat.default.structures_national_gdb/FeatureServer/layers 
