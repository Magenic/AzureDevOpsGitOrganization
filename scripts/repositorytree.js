var treeViewReference;
var oldShowPopup;

function convertTreeNodesToObjectsForSerialization(treeNodes) {
  return $.map(treeNodes, function (node) {
    var newNode = new Object();
    newNode.name = node.text;
    if (node.icon === "icon icon-folder") {
      newNode.nodeType = "folder";
    } else {
      newNode.nodeType = "repository";
      newNode.tag = node.tag;
    }
    if (node.hasChildren()) {
      newNode.children = convertTreeNodesToObjectsForSerialization(node.children);
    }
    return newNode;
  });
}

function loadTreeView(container) {
  VSS.require(["VSS/Controls", "VSS/Controls/TreeView"], function(Controls, TreeView) {
    VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService) {
      // Get value in user scope
      dataService.getValue("Magenic.SourceDirectories").then(function(value) {
          var folders;
          if (typeof value === "undefined") {
            folders = [];
          } else {
            folders = JSON.parse(value);
          }
          var nodes = convertToTreeNodes(folders, Controls, TreeView);
          treeViewReference = createTreeView(container, nodes, Controls, TreeView);
      });
    });
  });
}

// Converts the source to TreeNodes

function convertToTreeNodes(items, Controls, TreeView) {
    return $.map(items, function (item) {
      var node = TreeView.TreeNode.create(item.name);
      if (item.nodeType === "folder") {
        node.icon = "icon icon-folder";
      } else {
        node.tag = item.tag;
      }
      if (item.children && item.children.length > 0) {
        node.addRange(convertToTreeNodes(item.children, Controls, TreeView));
      }
      return node;
    });
  }

function createTreeView(container, nodes, Controls, TreeView) {
    var treeviewOptions = {
      width: 400,
      height: "100%",
      nodes: nodes,
      contextMenu: {
        items: getContextMenuItems(),
        executeAction: menuItemClick
      }
    };

     // Create the TreeView inside the specified container
    var returnValue = Controls.create(TreeView.TreeView, container, treeviewOptions);

    treeviewOptions.contextMenu.arguments = function(contextInfo) {
      return { item: contextInfo.item, treeView: returnValue };
    };

    oldShowPopup = returnValue.onShowPopupMenu;
 
    returnValue.onShowPopupMenu = onShowPopupMenu;

    return returnValue;
}

async function onShowPopupMenu(node, options) {
  var isFolder = false;
  if (node.icon === "icon icon-folder") {
    isFolder = true;
  }

  if (await userCanEdit()) {
    options.items[0].disabled = !isFolder;
    options.items[1].disabled = !isFolder;
    options.items[2].disabled = !isFolder;
    options.items[4].disabled = isFolder;

    treeViewReference.onShowPopupMenu = oldShowPopup;
    treeViewReference.onShowPopupMenu(node, options);
  
    treeViewReference.onShowPopupMenu = onShowPopupMenu;  
  }
}

async function menuItemClick(args) {
  var node = args.get_commandArgument().item;
  var treeView = args.get_commandArgument().treeView;
  switch (args.get_commandName()) {
    case "addfolder":
      updateNode(node, true, treeView);
      break;
    case "addrepository":
      addRepository(node, treeView);
      break;     
    case "delete":
      var result = await confirm(`Are you sure you want to delete ${node.text}?`);
      if (result) {
        var realNode = node.parent.children.find((f) => f.id === node.id);
        treeView.setSelectedNode(realNode.parent, true);
        realNode.parent.expanded = false;
        treeView.updateNode(realNode.parent);
        var index = realNode.parent.children.indexOf(realNode);
        realNode.parent.children.splice(index, 1);
        treeView.updateNode(realNode.parent);
        realNode.parent.expanded = true;
        treeView.updateNode(realNode.parent);
      }
      break;
    case "rename":
      updateNode(node, false, treeView);
      break;
    case "navigate":
      if (node.icon != "icon icon-folder") {
          window.top.location.href = node.tag;
      }
      break;
  }
}

function addRepository(node, treeView) {
  VSS.getService(VSS.ServiceIds.Dialog).then(function(dialogService) {
    var repositoryForm;

    var extensionCtx = VSS.getExtensionContext();
    var contributionId = extensionCtx.publisherId + "." + extensionCtx.extensionId + ".Magenic.SelectRepository";

    var dialogOptions = {
      title: "Select Repository",
      width: 450,
      height: 250,
      getDialogResult: function() {
          return repositoryForm ? repositoryForm.getFormData() : null;
      },
      okCallback: function (result) {
        if (result.repositoryId != null) {
          VSS.require(["VSS/Service", "TFS/VersionControl/GitRestClient", "VSS/Controls", "VSS/Controls/TreeView"], async function (VSS_Service, GIT_REST_CLIENT, Controls, TreeView) {
            var gitClient = VSS_Service.getCollectionClient(GIT_REST_CLIENT.GitHttpClient);

            var webContext = VSS.getWebContext();
        
            var repository =  await gitClient.getRepository(result.repositoryId, webContext.project.id);

            var newNode = TreeView.TreeNode.create(repository.name);
            node.addRange([newNode]);
            newNode.tag = repository.webUrl;
            node.expanded = true;
            treeView.updateNode(node);
          }); 
        }
      }
    };

    dialogService.openDialog(contributionId, dialogOptions).then(function(dialog) {
      dialog.getContributionInstance("Magenic.SelectRepository").then(function (repositoryFormInstance) {
        repositoryForm = repositoryFormInstance;
          
        repositoryForm.attachFormChanged(function(isValid) {
              dialog.updateOkButton(isValid);
          });
          repositoryForm.isFormValid().then(function (isValid) {
              dialog.updateOkButton(isValid);
          });
      });                            
  });
  });
}

function updateNode(node, isAdd, treeView) {
  VSS.getService(VSS.ServiceIds.Dialog).then(function(dialogService) {
    var directoryNameForm;
    var extensionCtx = VSS.getExtensionContext();
    var contributionId = extensionCtx.publisherId + "." + extensionCtx.extensionId + ".Magenic.DirectoryName";

    var nameToSend = isAdd? '' : node.text;

    var dialogOptions = {
        title: "Directory Name",
        width: 450,
        height: 250,
        getDialogResult: function() {
            return directoryNameForm ? directoryNameForm.getFormData() : null;
        },
        okCallback: function (result) {
            if (isAdd) {
              VSS.require(["VSS/Controls", "VSS/Controls/TreeView"], function(Controls, TreeView) {
                var newNode = TreeView.TreeNode.create(result.name);
                newNode.icon = "icon icon-folder";
                if (node == null) {
                  node = treeView.rootNode;
                }
                node.addRange([newNode]);
                node.expanded = true;
                treeView.updateNode(node);
              });
            } else {
              node.text = result.name;
              treeView.updateNode(node);
            }
        },
        urlReplacementObject: { myName: nameToSend }
    };

    dialogService.openDialog(contributionId, dialogOptions).then(function(dialog) {
        dialog.getContributionInstance("Magenic.DirectoryName").then(function (directoryNameFormInstance) {
          directoryNameForm = directoryNameFormInstance;
            
          directoryNameForm.attachFormChanged(function(isValid) {
                dialog.updateOkButton(isValid);
            });
            directoryNameForm.isFormValid().then(function (isValid) {
                dialog.updateOkButton(isValid);
            });
        });                            
    });
  });
}

function addRootNode() {
  updateNode(null, true, treeViewReference)
}

function saveNodes() {
  VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService) {
    var nodeObjects = convertTreeNodesToObjectsForSerialization(treeViewReference.rootNode.children);
    var serializeNodes = JSON.stringify(nodeObjects);
  
    dataService.setValue("Magenic.SourceDirectories", serializeNodes).then(function(value) {
        alert("Structure has been saved");
    });
});
}

function getContextMenuItems(args) {
  return [
      {
        id: "addfolder",
        text: "add Folder",
        icon: "icon-add",
        disabled: true
      },
      {
        id: "addrepository",
        text: "Add Repository",
        icon: "icon-add",
        disabled: true
      },
      {
        id: "rename",
        text: "Rename",
        disabled: true
      },
      { separator: true },
      {
        id: "navigate",
        text: "Navigate",
        disabled: true
      },
      { separator: true },
      {
        id: "delete",
        text: "Delete",
        icon: "icon-delete"
      }
  ];
}

function loadRepositoryCombo(container, valueLabel, validate) {
  VSS.require(["VSS/Service", "TFS/VersionControl/GitRestClient", "VSS/Controls", "VSS/Controls/Combos"], async function (VSS_Service, GIT_REST_CLIENT, Controls, Combos) {
    var gitClient = VSS_Service.getCollectionClient(GIT_REST_CLIENT.GitHttpClient);

    var webContext = VSS.getWebContext();

    var repositories =  await gitClient.getRepositories(webContext.project.id);
    repositories.sort((a, b) => (a.name > b.name) ? 1 : -1);

    var repositoryDescriptions = [];
    repositories.forEach(element => {
      repositoryDescriptions.push(element.name);
    });
    
    var options = {
      width: "400px",
      source: repositoryDescriptions,
      placeholderText: "Select a repository",
      indexChanged: function(index) {
        if (index >= 0) {
          var selectedItem = repositories[index];
          valueLabel.value = selectedItem.id;
        } else {
          valueLabel.value = null;
        }
        validate();
      },
    };
    
   var repositoryCombo = Controls.create(Combos.Combo, container, options);
  });
}

async function userCanEdit() {
  var result = await new Promise(function(resolve, reject) {
    VSS.require(["VSS/Service", "VSS/Security/RestClient"], async function(VSS_Service, Security_RestClient) {
      try {
        var client = VSS_Service.getCollectionClient(Security_RestClient.SecurityHttpClient5);
      
        var securityToken = VSS.getWebContext().project.id;
      
        var result = await client.hasPermissionsBatch({
          evaluations: [
            {
              "securityNamespaceId": "33344D9C-FC72-4d6f-ABA5-FA317101A7E9",
              "token": securityToken,
              "permissions": 16384 /* build administrator permissions */
            }
          ]
        });
        resolve(result);
      }
      catch(err) {
        reject(err);
      }
    });
  });
  return result.evaluations[0].value;
}

function editJson() {
  VSS.getService(VSS.ServiceIds.Dialog).then(function(dialogService) {
    var treeJsonForm;

    var extensionCtx = VSS.getExtensionContext();
    var contributionId = extensionCtx.publisherId + "." + extensionCtx.extensionId + ".Magenic.EditTreeJson";

    var dialogOptions = {
      title: "Edit Tree Json",
      width: 450,
      height: 350,
      getDialogResult: function() {
          return treeJsonForm ? treeJsonForm.getFormData() : null;
      },
      okCallback: function (result) {
        if (result.treeJson != null) { 
          var serializeNodes = result.treeJson;
          VSS.require(["VSS/Controls", "VSS/Controls/TreeView", "VSS/Controls/StatusIndicator"], function(Controls, TreeView, StatusIndicator) {
            var container = $("#mainBody");

            var waitControlOptions = {
              target: $("#mainBody"),
              cancellable: true
            };
  
            var waitControl = Controls.create(StatusIndicator.WaitControl, container, waitControlOptions);
            
            waitControl.startWait();

            VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService) {
              dataService.setValue("Magenic.SourceDirectories", serializeNodes).then(function(value) {

                var treeContainer = $('#treeContainer')[0];
                while (treeContainer.firstChild) {
                  treeContainer.removeChild(treeContainer.firstChild);
                }

                loadTreeView(treeContainer);
                waitControl.endWait();
            });

            });
          });
        }
      }
    };

    dialogService.openDialog(contributionId, dialogOptions).then(function(dialog) {
      dialog.getContributionInstance("Magenic.EditTreeJson").then(function (treeJsonFormInstance) {
        treeJsonForm = treeJsonFormInstance;
          
        treeJsonForm.attachFormChanged(function(isValid) {
              dialog.updateOkButton(isValid);
          });
        treeJsonForm.isFormValid().then(function (isValid) {
              dialog.updateOkButton(isValid);
          });
      });                            
    });
  });
}

function loadTreeJsonString(textAreaToLoad, validate) {
  VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService) {
    dataService.getValue("Magenic.SourceDirectories").then(function(value) {
      var folders;
      if (typeof value === "undefined") {
        folders = "[]";
      } else {
        folders = value;
      }
      textAreaToLoad.value = folders;
      validate();
    });
  });
}

async function validateJson(jsonValue) {
  var result = await new Promise(function(resolve, reject) {
    VSS.require(["VSS/Controls", "VSS/Controls/TreeView"], function(Controls, TreeView) {
      try {
        var folders = JSON.parse(jsonValue);
        var nodes = convertToTreeNodes(folders, Controls, TreeView);
        resolve(true);
      } catch (err) {
        resolve(false);
      }
    });
  });
  return result;
}