'use strict';

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/documents'];
const TOKEN_PATH = 'token.json';

let roomId;
let documentId;
module.exports = (robot) => {
  robot.respond(/DOC$/i, (res) => {
    roomId = res.message.room;
    // Load client secrets from a local file.
    const content = fs.readFileSync('credentials.json');
    authorize(JSON.parse(content), createDoc); // 認証できたら第2引数の関数を実行する
  });
  robot.respond(/D$/i, (res) => {
    roomId = res.message.room;
    authorizePromise() // 認証
    .then(createDocPromise) // 新規ドキュメント作成
    .then(printTitlePromise) // ドキュメント名を出力
    .then((msg) => sendMessage(roomId, "新規作成ドキュメント名: "+msg))
    .then((msg) => sendMessage(roomId, "新規作成ドキュメントid: "+documentId));
  });

  function sendMessage(roomId, msg) { // ここに書かないとメッセージ送信できない
    return new Promise(function(resolve, reject) {
      console.log("メッセージを送ります: " + msg);
      robot.send({ room: roomId }, { text: msg });
      resolve(roomId, msg);
    });
  }
};

// promiseを使って非同期処理(OAuth認証)を行う
function authorizePromise() {
  return new Promise(function(resolve, reject) {
    // promiseを利用して非同期処理を行う
    // authorizeと同じことを実行
    const content = fs.readFileSync('credentials.json');
    const credentials = JSON.parse(content);
    console.log("authorize");
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getAccessToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      console.log("authoP終わり");
      resolve(oAuth2Client); // 認証が成功するとresolveを返す
    });
  });
}
function printTitlePromise(title) {
  return new Promise(function(resolve, reject) {
    console.log("printTitleP始め");
    console.log(title);
    resolve(title);
  });
}
function createDocPromise(auth) {
  return new Promise(function(resolve, reject) {
    const docs = google.docs({version: 'v1', auth});
    const params = {
      title: roomId,
    };
    docs.documents.create(params, (err, res) => {
      if (err) { return console.log('The API returned an error: ' + err);}
      documentId = res.data.documentId;
      console.log("新規作成されたドキュメントのタイトル: " + res.data.title);
      console.log("新規作成されたドキュメントのid: " + res.data.documentId);
      console.log("createDocP終わり");
      resolve(res.data.title);
    });
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
// function authorize(credentials) {
//   console.log("authorize");
//   const {client_secret, client_id, redirect_uris} = credentials.installed;
//   const oAuth2Client = new google.auth.OAuth2(
//       client_id, client_secret, redirect_uris[0]);
//
//   // Check if we have previously stored a token.
//   fs.readFile(TOKEN_PATH, (err, token) => {
//     if (err) return getAccessToken(oAuth2Client, callback);
//     oAuth2Client.setCredentials(JSON.parse(token));
//     console.log("authorizeのなかの2client: " + oAuth2Client);
//     return oAuth2Client;
//   });
// }

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  console.log("getAccessToken");
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

// サンプルのdocsの情報を出力する関数
function printDocTitle(auth) {
  const docs = google.docs({version: 'v1', auth});
  docs.documents.get({
    documentId: '195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE',
  }, (err, res1) => {
    if (err) return console.log('The API returned an error: ' + err);
    console.log(`The title of the document is: ${res1.data.title}`);
  });
}
// ドキュメントのIDでファイルのタイトルを調べる
function getDocTitle(auth, myDocumentId) {
  const docs = google.docs({version: 'v1', auth});
  const params = {
    documentId: myDocumentId,
  };
  docs.documents.get(params, (err, res) => {
    if (err) { return console.log('The API returned an error: ' + err);}
    console.log(`The title of the document is: ${res.data.title}`);
    console.log("arg is: "+myDocumentId);
  });
}
