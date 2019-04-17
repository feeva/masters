#!/usr/bin/env node

const program = require('commander');

program
    .usage('[options] [file]')
    .description('Scrapes the message board of SBS Masters of life')
    .option('-d, --debug', 'output debug messages')
    .parse(process.argv)
    ;

const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.80 Safari/537.36';
var scrapeNo = 0;

function scrape(url, callback) {
    var options = {
        url: url,
        headers: {
            'User-Agent': USER_AGENT
        }
    };

    scrapeNo++;
    if (program.debug)
        console.log(scrapeNo + ': ' + url);

    request(options, function(error, response, body) {
        if (error) {
            console.error('오류!', error);
            return;
        }

        var nextUrl = callback(scrapeNo, url, body, response);
        if (nextUrl) {
            setTimeout(function() {
                scrape(nextUrl, callback);
            }, 250);
        }
    });
}

const START_URL = 'http://api.board.sbs.co.kr/bbs/V2.0/basic/board/lists?limit=1&action_type=json&board_code=lifemaster_bd01&offset=';
const URL_PATTERN = 'http://api.board.sbs.co.kr/bbs/V2.0/basic/board/detail/{}?action_type=json&board_code=lifemaster_bd01';
const out = (program.args && program.args[0] ? fs.createWriteStream(program.args[0]) : process.stdout);

var retryCount = 0;

var doScrape = function (scrapeNo, url, body, response) {
    let obj = JSON.parse(body).Response_Data_For_Detail;
    if (!obj)
        return null;

    let title = obj.TITLE;
    let date = obj.REG_DATE;
    let content = obj.CONTENT;
    let no = obj.NO;

    const $ = cheerio.load(content);
    body = '';
    $('p:not(:has(div, p)), div:not(:has(p, div))').each(function(idx, elem) {
        body += $(elem).text() + '\n';
    });

    out.write(title + '\n' + date + '\n' + body + '\n-----\n');

    let prevNo = obj.PREV_NO;
    if (prevNo === '0')
        return null;

    return URL_PATTERN.replace('{}', prevNo);
};

scrape(START_URL + '0', function(scrapeNo, url, body, response) {
    let obj = JSON.parse(body);
    let no = obj.list[0].NO;
    url = URL_PATTERN.replace('{}', no);

    scrape(url, doScrape);
});

