var util = require('util');

var inputText = {
  // キーはroomId、値はメッセージの配列
  // inputText["001"] でメッセージの配列を取得できる
  "001": ["# 授業メモ", "## 第12回 7/10",],
  "002": ["# 授業メモ", "## 第1回 7/10",],
}
let roomId = "invalid";
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
module.exports = (robot) => {
  robot.respond(/T$/i, (res) => {
    console.log(inputText);
    let sendTxt = util.inspect(inputText,false,null);
    res.send(sendTxt);
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
        for (v in lines) {
          console.log("保存する文章: "+lines[v]);
          storeMessage(roomId, lines[v]);
        }
      } else {
        storeMessage(roomId, slicedMessage);
      }
      // res.send(inputText[roomId]);
    }
  });
};
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
