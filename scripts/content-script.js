// chrome.runtime.sendMessage({greeting: '你好，我是content-script呀，我主动发消息给后台！'}, function(response) {
//   console.log('收到来自后台的回复：' + response);
// });

chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    console.log(request.message);
    console.log("");
});