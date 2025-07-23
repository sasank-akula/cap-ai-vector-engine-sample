namespace sap.advocates.demo;

using { cuid,managed } from '@sap/cds/common';

entity DocumentChunk:cuid, managed {
    text_chunk: LargeString;
    metadata_column: LargeString;
    embedding: Vector(1536);
}
