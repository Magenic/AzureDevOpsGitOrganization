![alt tag](/icon.png?raw=true "Azure DevOps Git Directory Categorization")

# Azure DevOps Git Directory Categorization
Allows users to categorize multiple git repositories within a single Azure DevOps project.

# Viewing and Editing
While any member of the organization can view the tree and attempt to navigate to the repository, in order to modify the tree by adding folders or repository links, the user must have a build administrator permissions.

# TreeView Json
For organizations that have a large number of repositories, there is a button to allow the json that defines the structure to be edited manually. The Json has the following structure:

A folder object uses the following format:
{"name":"Name to show for folder","nodeType":"folder","children": [*list of folder and repository objects*]}

A repository object uses the following format
{"name":"Name to show for repository","nodeType":"repository","tag":"URL to Repository"}

The top level of the jason is a simple array:

[*list of folder and repository objects*]

Example:
[
    {"name":"Folder1","nodeType":"folder","children": [
        {"name":"Repository1","nodeType":"repository","tag":"https://someUrl"}
    ]},
    {"name":"Folder2","nodeType":"folder","children": [
        {"name":"SubFolder1","nodeType":"folder","children": [
            {"name":"Repository2","nodeType":"repository","tag":"https://someUrl"}
        ]},
        {"name":"SubFolder2","nodeType":"folder","children": [
            {"name":"Repository3","nodeType":"repository","tag":"https://someUrl"}
        ]}
    ]},
    {"name":"Repository4","nodeType":"repository","tag":"https://someUrl"}
]

This json would create the following tree view:
![example treeview](/images/treeexample.png?raw=true "Example Treeview: ")