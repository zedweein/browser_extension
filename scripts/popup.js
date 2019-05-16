let opened = false;
let intv;
let systemData = document.getElementById('systemData');
systemData.onclick = function () {
  var hosturl = $("#hosturl").val();
  var pattern = $("#pattern").val();
  if(hosturl.replace(/\s+/g,"").lenght == 0){
    return;
  }
  if(pattern.replace(/\s+/g,"").lenght == 0){
    return;
  }
  if (opened) {
    opened = false;
    if (intv) {
      clearInterval(intv);
      intv = null;
      systemData.innerHTML = "捕获系统数据";
    }
    chrome.debugger.getTargets((targets) => {
      let target;
      if (targets && targets.length > 0) {
        for (var i = 0; i <= targets.length; i++) {
          if (targets[i].url.indexOf(hosturl) != -1) {
            target = targets[i];
            break;
          }
        }
      }
      if(target==null){
        alert("未找到调试器,请检查系统路径是否正确");
        return;
      }
      chrome.debugger.detach({
        targetId: target.id
      }, function () {
        alert("已经停止捕获数据");
      });
    });
    return;
  }
  opened = true;
  var i = 1;
  systemData.innerHTML = "正在捕获数据,查看控制台";
  intv = setInterval(() => {
    if (i % 1 == 0) {
      systemData.innerHTML = "正在捕获数据,查看控制台.";
    }
    if (i % 2 == 0) {
      systemData.innerHTML = "正在捕获数据,查看控制台..";
    }
    if (i % 3 == 0) {
      systemData.innerHTML = "正在捕获数据,查看控制台...";
    }
    i++;
  }, 1000)

  // chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  //   sendResponse('我是后台，我已收到你的消息：' + JSON.stringify(request));
  // });

  chrome.debugger.getTargets((targets) => {
    let target;
    if (targets && targets.length > 0) {
      for (var i = 0; i <= targets.length; i++) {
        if (targets[i].url.indexOf(hosturl) != -1) {
          target = targets[i];
          break;
        }
      }
    }
    let debuggee = {
      targetId: target.id
    };
    chrome.debugger.attach(debuggee, "1.2", () => {
      chrome.debugger.sendCommand(debuggee, "Network.enable", {
        enabled: true
      });
    });


    var gAttached = false;
    var gRequests = [];
    var gObjects = [];

    chrome.debugger.onEvent.addListener(function (source, method, params) {
      if (method == "Network.requestWillBeSent") {
        var rUrl = params.request.url;
        if (getTarget(rUrl) >= 0) {
          gRequests.push(rUrl);
        }
      }
      if (method == "Network.responseReceived") {
        var eUrl = params.response.url;
        var target = getTarget(eUrl);
        if (target >= 0) {
          gObjects.push({
            requestId: params.requestId,
            target: target,
            url: eUrl
          });
        }
      }
      if (method == "Network.loadingFinished" && gObjects.length > 0) {
        var requestId = params.requestId;
        var object = null;
        for (var o in gObjects) {
          if (requestId == gObjects[o].requestId) {
            object = gObjects.splice(o, 1)[0];
            break;
          }
        }
        if (object == null) {
          return;
        }
        gRequests.splice(gRequests.indexOf(object.url), 1);
        chrome.debugger.sendCommand(
          source,
          "Network.getResponseBody", {
            "requestId": requestId
          },
          function (response) {
            if (response) {
              var b = response.body;
              if (b.indexOf('[') == -1) {
                if (b.indexOf("\}") != -1) {
                  b = b.substring(b.indexOf(',', 2) + 1, b.length - 2).split("\,")[1];
                } else {
                  b = b.substring(b.indexOf(',', 2) + 1, b.length - 3).split("\,")[1];
                }
              } else {
                b = b.substring(b.indexOf('['), b.length - 3);
              }

              chrome.tabs.query({
                active: true,
                currentWindow: true
              },function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  message: {
                      "url" : object.url,
                      "data": b
                  }
                }, function (response) {});
              });

            }
            if (gRequests.length == 0) {
              chrome.debugger.detach({
                tabId: source.tabId
              }, function () {
                chrome.debugger.attach({
                  tabId: source.tabId
                }, "1.0", function () {
                  chrome.debugger.sendCommand({
                    tabId: source.tabId
                  }, "Network.enable");
                });
              });
            }
          });
      }
    });
    var initialListener = function (details) {
      if (gAttached) return; // Only need once at the very first request, so block all following requests
      var tabId = details.tabId;
      if (tabId > 0) {
        gAttached = true;
        chrome.debugger.attach({
          tabId: tabId
        }, "1.0", function () {
          chrome.debugger.sendCommand({
            tabId: tabId
          }, "Network.enable");
        });
        // Remove self since the debugger is attached already
        chrome.webRequest.onBeforeRequest.removeListener(initialListener);
      }
    };
    // Attach debugger on startup
    chrome.webRequest.onBeforeRequest.addListener(initialListener, {
      urls: ["<all_urls>"]
    }, ["blocking"]);

    function getTarget(url) {
      for (var i in TARGETS) {
        var target = TARGETS[i];
        if (url.indexOf(target.url) != -1) {
          return i;
        }
      }
      return -1;
    }
    const TARGETS = [{
      url: hosturl + pattern
    }]
  });
}