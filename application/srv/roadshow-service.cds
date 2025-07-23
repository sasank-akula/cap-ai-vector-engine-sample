@(requires:'authenticated-user')
service RoadshowService {

    function getRagResponse(question : String) returns String;
    function executeSimilaritySearch() returns String;

}