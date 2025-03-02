'use strict';

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';
var util = require('util');
const fontList = ['Arial', 'M PLUS Rounded 1c'];

module.exports = (robot) => {
  robot.respond(/DOC$/i, (res) => {
    let roomId = res.message.room;
    // Load client secrets from a local file.
    const content = fs.readFileSync('credentials.json');
    authorize(JSON.parse(content), createDoc); // 認証できたら第2引数の関数を実行する
  });
  robot.respond(/D$/i, (res) => {
    authorizePromise() // 認証
    .then(createDocPromise) // 新規ドキュメント作成
    // .then(printTitlePromise) // ドキュメント名を出力
    // .then((msg) => sendMessage(roomId, "新規作成ドキュメント名: "+msg))
    // .then((msg) => sendMessage(roomId, "新規作成ドキュメントid: "+documentId))
    .then(updateDocPromise)
    // .then(listFiles)
    .then(downloadFilePromise)
    .then(sendFilePromise)
    .then(deleteFilePromise);
  });
  robot.respond(/T$/i, (res) => {
    console.log(inputText);
    let sendTxt = util.inspect(inputText,false,null);
    res.send(sendTxt);
    sendTxt = util.inspect(userNoteMode,false,null);
    res.send(sendTxt);
    sendTxt = util.inspect(userDocumentId,false,null);
    res.send(sendTxt);
    sendTxt = util.inspect(userParams,false,null);
    res.send(sendTxt);
  });
  robot.respond(/NOTE$/i, (res) => { // noteモード開始
    if (userNoteMode[getRoomId()] == false || typeof userNoteMode[getRoomId()] == "undefined") {
      res.send("markdownからノートを作ります。");
      userNoteMode[getRoomId()] = true;
      userTheme[getRoomId()] = 0;
    } else {
      userNoteMode[getRoomId()] = false;
      res.send("noteモードを終了しました。");
      res.send(util.inspect(inputText[getRoomId()], false, null));
    }
  });
  robot.respond(/mynote$/i, (res) => {
    let myNote = util.inspect(inputText[getRoomId()],false,null);
    res.send(myNote);
  });
  robot.respond(/delete$/i, (res) => {
    delete inputText[getRoomId()];
    res.send("ノートの内容を削除しました。");
  });
  var questionSentId = {}; // ルームIDごとに質問IDを格納する
  robot.respond(/theme$/i, (res) => {
    res.send({
      question: 'テーマを変更しますか？',
      options: fontList,
      onsend: (sent) => {
        questionSentId[res.message.rooms] = sent.message.id;
        console.log(questionSentId);
      }
    });
  });
  robot.respond('select', (res) => { // 相手が回答したらセレクトスタンプを締め切る
    if (res.json.response !== null) {
      userTheme[getRoomId()] = res.json.response;
      console.log(userTheme);
      res.send({
        text: 'テーマの変更を受け付けました: ' + res.json.options[res.json.response],
        onsend: (sent) => {
          res.send({
            close_select: questionSentId[res.message.rooms]
          });
        }
      });
    }
  })
  robot.respond(/help$/i, (res) => {
    res.send("講義ノート作成Bot\n" +
    "ボットに話しかけた内容からドキュメントを作成し、PDFをトークルームに送信します。\n\n" +
    "使用方法\n" +
    "noteコマンドでノートの作成を開始、もう一度noteコマンドを押すまでがノート内容となります。\n\n" +
    "noteモード中に使える機能\n" +
    "mynote -> ノート内容の確認\n" +
    "delete -> ノート内容をすべて削除\n\n" +
    "ノートモードが終了すると、内容を送信します。この内容でドキュメントを作成するには、dコマンドを送信します。\n" +
    "少し待つと、チャットボットからPDFが送られてきます。"
    );
  })
  robot.respond(/(.*)/i, (res) => { // noteモード中はメッセージをためる
    var slicedMessage = res.message.text.slice(6); // 先頭のHubot を取り除く
    console.log(slicedMessage);
    if ( slicedMessage.search(/(^|\n)(t|note|d|mynote|delete|help)$/i) != -1 ) { // 他のコマンドと競合しないようにする
      return;
    } else if (userNoteMode[getRoomId()] == true) {
      // storeMessage(res.message.room, res.match[1])
      let roomId = res.message.room;
      if (slicedMessage.match(/\n/) != null) { // \nが入っているときは行にわける
        var lines = slicedMessage.split('\n');
        for (var v in lines) {
          console.log("保存する文章: "+lines[v]);
          storeMessage(getRoomId(), lines[v]);
        }
      } else {
        storeMessage(getRoomId(), slicedMessage);
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
  function getRoomId() {
    let user = robot.brain.rooms();
    return Object.keys(user)[0];
  }


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
          title: getRoomId()+"_"+date,
        };
        docs.documents.create(params, (err, res) => {
          if (err) { return console.log('The API returned an error: ' + err);}
          userDocumentId[getRoomId()] = res.data.documentId;
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
        // var content = [ '# システムモデリング 第13回 7/10', '## データモデリング', '### ER図の構成要素', 'ER図とは、Entity Relationship' ];
        var content = inputText[getRoomId()];
        console.log("あなたの発言をドキュメント化します: " + content);
        userParams[getRoomId()] = sendMessageBuilder(content);

        console.log("最終的なリクエスト文: "+util.inspect(userParams[getRoomId()], false, null));

        docs.documents.batchUpdate(userParams[getRoomId()], (err, res) => {
          console.log(userDocumentId[getRoomId()]);
          if (err) { return console.log('The API returned an error: ' + err);}
          console.log("アップデートしました");
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
        let destFilePath = './tmp/' + getRoomId() + '.pdf';
        var dest = fs.createWriteStream(destFilePath);
        console.log("DL開始: " + userDocumentId[getRoomId()]);
        drive.files.export({fileId: userDocumentId[getRoomId()], mimeType: 'application/pdf'}, {responseType: 'stream'},
        function(err, res){
          if (err) {return console.error(err);}
          res.data
          .on('end', () => {
            console.log('Done');
            resolve(destFilePath);
          })
          .on('error', err => {
            console.log('Error', err);
          })
          .pipe(dest);
        });
      });
    }
    function sendFilePromise(filePath) {
      return new Promise(function(resolve, reject) {
        robot.send(
          { room: getRoomId() },
          { path: filePath,
            name: 'output.pdf',    // (Option) アップロード名
            type: 'application/pdf',   // (Option) MIME
            text: '完成したPDFです。',   // (Option) ファイルと同時に送信するテキスト
          }, () => {
            console.log("PDF送信完了");
            resolve(filePath);
          }
        );
      });
    }
    function deleteFilePromise(filePath) {
      return new Promise(function(resolve, reject) {
        // PDFファイル送信まで達成したら、変数にあるコンテンツ内容とサーバのPDFを削除
        delete inputText[getRoomId()];
        delete userDocumentId[getRoomId()];
        resolve();
        // fs.unlink(filePath, (err) => {
        //   if (err) {throw err;}
        //   else {
        //     console.log('削除しました');
        //     resolve();
        //   }
        // });
      })
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
      _00010001: ['# 授業メモ', '## 第12回 7/10',],
      _00010002: ['# 授業メモ', '## 第12回 7/10',],
    };
    var userNoteMode = { // trueのときは入力をすべてノートに入力する
      _00010001: false,
      _00010002: false,
    };
    var userDocumentId = {
      _00010001: "testDocumentId",
      _00010002: "testDocumentId",
    }
    var userParams = {
      _00010001: "testParams",
      _00010002: "testParams",
    }

    var userTheme = {
      _00010001: 0,
      _00010002: 0,
    }

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
    function generateFontChangeParams(themeId) { // フォント変更リクエストのparams
      return {
        "updateTextStyle": 
        {"fields": "*",
        "range": {
          "startIndex": 1,"endIndex": 2
        },
        "textStyle": {
          "weightedFontFamily": {
            "fontFamily": fontList[themeId]
          }
        }}};
    }
    function generateParagraphBullets() {
      return {
        "createParagraphBullets": {
        "range": {
          "startIndex": 1,
          "endIndex": 2
        },
        "bulletPreset": "BULLET_DISC_CIRCLE_SQUARE"
      }};
    }
    function deleteParagraphBullets() {
      return {
        "deleteParagraphBullets": {
          "range": {
            "startIndex": 1,
            "endIndex": 2
          }
        }
      };
    }
    function sendMessageBuilder(messages) { // メッセージの配列を渡すと、フォーマットと挿入文字列を作成して返す
      console.log(userDocumentId);
      const params = {"documentId": userDocumentId[getRoomId()],"resource": {"requests": []}}; // ドキュメント変更の基本的なparams、これに追加していく
      params.resource.requests.push(generateFontChangeParams(userTheme[getRoomId()])); // ユーザが選択した、文書全体のフォントテーマをリクエストに追加
      messages.reverse();

      for (var m in messages) {
        var slicedMessage = messages[m]; // 本文テキストは切り出ししない
        if (messages[m].match(/^# (.*)$/ig)) {
          params.resource.requests.push(generateStyleChangeParams(1));
          slicedMessage = messages[m].slice(2);
        } else if (messages[m].match(/^## (.*)$/ig)) {
          params.resource.requests.push(generateStyleChangeParams(2));
          slicedMessage = messages[m].slice(3);
        } else if (messages[m].match(/^### (.*)$/ig)) {
          params.resource.requests.push(generateStyleChangeParams(3));
          slicedMessage = messages[m].slice(4);
        } else if (messages[m].match(/^#### (.*)$/ig)) {
          params.resource.requests.push(generateStyleChangeParams(4));
          slicedMessage = messages[m].slice(5);
        } else if (messages[m].match(/^##### (.*)$/ig)) {
          params.resource.requests.push(generateStyleChangeParams(5));
          slicedMessage = messages[m].slice(6);
        } else if (messages[m].match(/^###### (.*)$/ig)) {
          params.resource.requests.push(generateStyleChangeParams(6));
          slicedMessage = messages[m].slice(7);
        } else if (messages[m].match(/^- (.*)$/ig)) { // 箇条書き
          params.resource.requests.push(generateStyleChangeParams(0)); // テキストスタイルはNORMAL
          params.resource.requests.push(generateParagraphBullets()); // 箇条書きスタイルを生成
          slicedMessage = messages[m].slice(2);
          params.resource.requests.push(generateTextParams(["\n", slicedMessage])); // テキスト挿入
          params.resource.requests.push(deleteParagraphBullets()); // 箇条書きスタイルを削除
          continue;
        } else {
          params.resource.requests.push(generateStyleChangeParams(0));
        }
        if (m == messages.length-1) {
          // 文章の最後の要素なら、改行を入れないで文章を挿入
          params.resource.requests.push(generateTextParams([slicedMessage]));
        } else {
          // 文章の最後以外の要素なら、次の文章のために改行記号も追加
          params.resource.requests.push(generateTextParams(["\n", slicedMessage]));
        }
      }
      return params;
    }
  };