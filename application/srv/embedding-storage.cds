using { sap.advocates.demo as db } from '../db/schema';

@(requires:'authenticated-user')
service EmbeddingStorageService {
    entity DocumentChunk as projection on db.DocumentChunk excluding { embedding };

    function storeEmbeddings() returns String;
    function deleteEmbeddings() returns String;
}