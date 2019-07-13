'use strict';

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';
var util = require('util');

let roomId;
var documentId;
let userParams;
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
    // .then(printTitlePromise) // ドキュメント名を出力
    // .then((msg) => sendMessage(roomId, "新規作成ドキュメント名: "+msg))
    // .then((msg) => sendMessage(roomId, "新規作成ドキュメントid: "+documentId))
    .then(updateDocPromise)
    // .then(listFiles)
    .then(downloadFilePromise);
  });
  robot.respond(/T$/i, (res) => {
    console.log(inputText);
    let sendTxt = util.inspect(inputText,false,null);
    res.send(sendTxt);
    let arr = [ 'hello', 'world', 'こんにちは！' ];
    console.log(mergeText(arr));
  });
  robot.respond(/NOTE$/i, (res) => { // noteモード開始
    if (noteMode == false) {
      res.send("markdownからノートを作ります。");
      noteMode = true;
    } else {
      noteMode = false;
      res.send("noteモードを終了しました。")
      res.send(util.inspect(inputText[roomId], false, null));
    }
  });
  robot.respond(/(.*)/i, (res) => { // noteモード中はメッセージをためる
    var slicedMessage = res.message.text.slice(6); // 先頭のHubot を取り除く
    console.log(slicedMessage);
    if ( slicedMessage.search(/(^|\n)(t|note)$/) != -1 ) { // tとnoteコマンドと競合しないようにする
      return;
    } else if (noteMode == true) {
      // storeMessage(res.message.room, res.match[1])
      roomId = res.message.room;
      if (slicedMessage.match(/\n/) != null) { // \nが入っているときは行にわける
        var lines = slicedMessage.split('\n');
        for (var v in lines) {
          console.log("保存する文章: "+lines[v]);
          storeMessage(roomId, lines[v]);
        }
      } else {
        storeMessage(roomId, slicedMessage);
      }
      // res.send(inputText[roomId]);
    }
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
      // if (err) return getAccessToken(oAuth2Client, callback);
      if (err) return getAccessToken(oAuth2Client);
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
    let date = new Date().toISOString();
    const params = {
      title: roomId+"_"+date,
    };
    docs.documents.create(params, (err, res) => {
      if (err) { return console.log('The API returned an error: ' + err);}
      documentId = res.data.documentId;
      console.log("新規作成されたドキュメントのタイトル: " + res.data.title);
      console.log("新規作成されたドキュメントのid: " + res.data.documentId);
      console.log("createDocP終わり");
      resolve(auth);
    });
  });
}
function mergeReverseText(txt) {
  var returnTxt = "";
  // txt.reverse();
  for (var t in txt) {
    returnTxt += txt[t];
  }
  console.log("マージされたのは"+returnTxt+"です。");
  return returnTxt;
}
// [ 'hello', 'world', 'こんにちは！' ]
function updateDocPromise(auth) {
  return new Promise(function(resolve, reject) {
    const docs = google.docs({version: 'v1', auth});
    var content = [ '# システムモデリング 第13回 7/10', '## データモデリング', '### ER図の構成要素', 'ER図とは、Entity Relationship' ];
    const userParams = sendMessageBuilder(content);

    console.log("最終的なリクエスト文: "+util.inspect(userParams, false, null));

    docs.documents.batchUpdate(userParams, (err, res) => {
      console.log(documentId);
      if (err) { return console.log('The API returned an error: ' + err);}
      console.log("アップデートしました。");
      resolve(auth);
    });
  });
}

function listFiles(auth) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    pageSize: 10,
    fields: "nextPageToken, files(id, name)",
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    console.log("resは"+res);
    if (files.length) {
      console.log('Files:');
      files.map((file) => {
        console.log(`${file.name} (${file.id})`);
      });
    } else {
      console.log('No files found.');
    }
  });
}
function downloadFilePromise(auth) {
  return new Promise(function(resolve, reject) {
    const drive = google.drive({version: 'v3', auth});
    console.log("drive: "+drive);
    // var fileId = "1Vjn9lqFmxyxDS9xzBT-_fo9WjW1hfI9SUtcYWdvoJHI";
    var dest = fs.createWriteStream('./tmp/resume.pdf');
    console.log("DL開始: " + documentId);
    drive.files.export({fileId: documentId, mimeType: 'application/pdf'}, {responseType: 'stream'},
    function(err, res){
      if (err) {return console.error(err);}
        res.data
        .on('end', () => {
            console.log('Done');
        })
        .on('error', err => {
            console.log('Error', err);
        })
        .pipe(dest);
    });

    resolve(auth);
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
// function getAccessToken(oAuth2Client, callback) {
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
      // callback(oAuth2Client);
      return;
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

var inputText = {
  // キーはroomId、値はメッセージの配列
  // inputText["001"] でメッセージの配列を取得できる
  "001": ["# 授業メモ", "## 第12回 7/10",],
  "002": ["# 授業メモ", "## 第1回 7/10",],
}
roomId = "invalid";
var noteMode = false; // trueのときは入力をすべてノートに入力する

function storeMessage(roomId, message) { // roomIdをキーとするメッセージの配列を作る
  // var slicedMessage = message.slice(6); // 先頭のHubot を取り除く
  if (inputText[roomId]) {
    console.log("すでに存在するroomIdです。");
    inputText[roomId].push(message);
  } else {
    console.log("新しいroomIdです。");
    inputText[roomId] = []; // 新しく配列を作成する
    inputText[roomId].push(message);
  }
}
function generateTextParams(text) { // テキスト挿入リクエストのparams
  return {"insertText": {"location": {"index": 1},"text": mergeReverseText(text)}};
}
const namedStyle = { // 名前付きのスタイルの辞書
  0: "NORMAL_TEXT",
  1: "HEADING_1",
  2: "HEADING_2",
  3: "HEADING_3",
  4: "HEADING_4",
  5: "HEADING_5",
  6: "HEADING_6",
  7: "TITLE",
  8: "SUBTITLE"
};
function generateStyleChangeParams(level) { // 見出しのスタイル変更リクエストのparams
  return {"updateParagraphStyle": {"range": {"startIndex": 1,"endIndex": 2},"fields": "*","paragraphStyle": {"namedStyleType": namedStyle[level]}}};
}
function sendMessageBuilder(messages) { // メッセージの配列を渡すと、フォーマットと挿入文字列を作成して返す
  const params = {"documentId": documentId,"resource": {"requests": []}}; // ドキュメント変更の基本的なparams、これに追加していく
  console.log("ここでparams"+util.inspect(params));
  messages.reverse();

  params.resource.requests.push(
    generateStyleChangeParams(0),
    generateTextParams(["\n", messages[0]]),
    generateStyleChangeParams(3),
    generateTextParams(["\n", messages[1]]),
    generateStyleChangeParams(2),
    generateTextParams(["\n", messages[2]]),
    generateStyleChangeParams(1),
    generateTextParams(["\n", messages[3]]),
  )
  return params;
}

/* 見出し1にするリクエスト
手順: 下から解析する、下からスタイル変更リクエストを出し、先頭に挿入する
{
  "requests": [
    {
      "updateParagraphStyle": {
        "range": {
          "startIndex": 1,
          "endIndex": 2
        },
        "paragraphStyle": {
          "namedStyleType": "HEADING_1"
        },
        "fields": "*"
      }
    }
  ]
}
*/
