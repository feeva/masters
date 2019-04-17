#!/usr/bin/env node

const program = require('commander');

program
    .usage('[options] <input file>')
    .description('Search for Korean addresses in text and geocode them')
    .option('-o, --output <path>', 'json file to write. default is stdout')
    .option('-d, --debug', 'output debug messages')
    .parse(process.argv)
    ;

if (!program.args.length) {
    program.help();
}

const request = require('request');
const fs = require('fs');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.80 Safari/537.36';

function getLocations() {
    var get = fs.readFile;

    get(program.args[0], 'utf-8', function(error, arg1, arg2) {
        var sbsContent = typeof arg1 === 'string' ? arg1 : arg2;

        get('./data/administrative.txt', 'utf-8', function(error, arg1, arg2) {
            var content = typeof arg1 === 'string' ? arg1 : arg2;
            var adminLines = content.split(/\r?\n/g);
            var sido = [], sigungu = [];
            for (var i = 0; i < adminLines.length; ++i) {
                var l = adminLines[i];
                if (l) {
                    var items = l.split(/\t/g);
                    if (l.charAt(0) === '\t') {
                        sigungu.push(items[2]);
                    } else {
                        for (var j = 1; j < items.length; ++j)
                            sido.push(items[j]);
                    }
                }
            }

            var pattern = new RegExp('((' + sido.join('|') + '|' + sigungu.join('|') + ')[가-힣\\s\\w]+?[시군구읍면동길].*?\\d.*?)($|☎)', 'mg');
            if (program.debug)
                console.log('주소 패턴: ' + pattern);

            var list = [], called = 0;
            const out = (program.output ? fs.createWriteStream(program.output) : process.stdout);

            var callGeocode = function() {
                var matched = pattern.exec(sbsContent);
                if (matched) {
                    called++;
                    if (program.debug)
                        console.log(called + ': ' + matched[1]);

                    geocode({
                        index: matched.index,
                        address: matched[1]
                    }, list, callGeocode);

                } else {
                    console.log(list.length + ' of ' + called + ' geocodings successful');
                    var result = {updated: new Date().getTime(), list: list};
                    var json = JSON.stringify(result);
                    out.write(json);
                    if (out !== process.stdout)
                        out.end();
                }
            };

            callGeocode();
        });
    });
}

var GEO_API = 'https://dapi.kakao.com/v2/local/search/address.json?query='

function geocode(data, list, callback) {
    var options = {
        url: GEO_API + encodeURIComponent(data.address),
        headers: {
            'User-Agent': USER_AGENT,
            'Authorization': ''
        }
    };

    request(options, function(error, response, out) {
        if (error) {
            console.error('Error while geocoding "' + data.address + '":');
            console.error(error.stack);
        } else {
            var obj;
            try {
                obj = JSON.parse(out);
            } catch (error) {
                console.error('Error while parsing response to JSON:\n' + out);
                console.error(error.stack);
                return;
            }

            if (obj && obj.documents && obj.documents.length) {
                var geo = obj.documents[0];
                if (!geo) {
                    if (program.debug)
                        console.log('Address unresolved: ' + data.address);
                } else {
                    var item = {
                        index: data.index,
                        address: data.address,
                        lat: geo.y,
                        lng: geo.x
                    };
                    list.push(item);
                }
            }
        }

        if (callback)
            callback();
    });
}

getLocations();

