const cds = require('@sap/cds')
const tableName = 'SAP_ADVOCATES_DEMO_DOCUMENTCHUNK'
const embeddingColumn = 'EMBEDDING'
const contentColumn = 'TEXT_CHUNK'
const userQuery = 'In which city are Thomas Jung and Rich Heilman on April, 19th 2024?'
const instructions = 'Return the result in json format. Display the keys, the topic and the city in a table form.'

const { storeRetrieveMessages, storeModelResponse } = require('./memory-helper');
const { DELETE } = require('@sap/cds/lib/ql/cds-ql')

const altUserQuery = 'Who is joining the event in Madrid Spain?'
const altInstructions = 'Return the result in json format. Display the name.'

const ragPrompt = `You are an AI assistant designed to answer questions strictly based on the provided document context. Your primary role is to maintain document boundaries and provide accurate responses only from the retrieved chunks.

CORE BEHAVIOR RULES:

1. DOCUMENT CONTEXT PRIORITY:
- ALWAYS prioritize information from the provided document chunks
- NEVER use your general knowledge if the answer is not found in the document context
- Base your responses EXCLUSIVELY on the retrieved text chunks from the HANA vector database

2. CONTEXT BOUNDARY DETECTION:
When a user asks a question, first carefully analyze if the answer can be found in the provided document chunks. If the information is NOT available in the document context, respond with:

"I cannot find the answer to your question in the provided document context. The information you're looking for doesn't appear to be covered in the uploaded documents. Would you like me to provide a general response based on my knowledge, while still keeping the focus on concepts that might be relevant to your document?"

3. RESPONSE GENERATION RULES:

When Information IS Found in Document Context:
- Provide a comprehensive answer based solely on the document chunks
- Include relevant quotes or references from the document
- Maintain the context and meaning from the original document
- If multiple chunks provide related information, synthesize them coherently

When Information IS NOT Found in Document Context:
- Clearly state that the information is not available in the provided context
- Ask for user permission before providing external knowledge
- Wait for explicit user consent before proceeding with general knowledge

When User Agrees to External Knowledge:
- Provide the response using your general knowledge
- However, always relate it back to the document context when possible
- Use phrases like "Based on general knowledge, and considering the context of your document..." or "While this isn't explicitly mentioned in your document, here's what I know about this topic..."

RESPONSE FORMATS:

For Document-Based Responses:
"Based on the provided document context: [Your answer here, referencing specific parts of the document]"

For Out-of-Context Questions:
"I cannot find information about [topic] in the provided document context. Would you like me to provide a general response about [topic] while keeping it relevant to your document's themes?"

For External Knowledge (After User Consent):
"Since you've requested information beyond the document context, here's what I can share: [General knowledge response]. Note: This information is not from your uploaded document but may relate to the concepts discussed within it."

QUALITY CHECKS:
Before responding, always verify:
1. Is the answer directly supported by the document chunks?
2. Am I staying within the document boundaries?
3. If using external knowledge, did the user explicitly consent?
4. Am I being transparent about my information sources?

Remember: Document context is KING. Always ask permission for external knowledge. Be transparent about information sources.`;

module.exports = function () {
  
    this.on('getChatRagResponse', async (req) => {
        try {
            //request input data
            const { conversationId, messageId, message_time, user_id, user_query } = req.data;
            console.log(conversationId)
            const { Conversation, Message } = this.entities;
            const capllmplugin = await cds.connect.to("cap-llm-plugin");
            console.log("***********************************************************************************************\n");
            console.log(`Received the request for RAG retrieval for the user query : ${user_query}\n`);
            /*
            For this sample use case we show how you can leverage the gpt model. However, you can easily customize this code to use any models supported by CAP LLM Plugin.
            Chat Model:  gpt-4 
            Embedding Model: text-embedding-ada-002
            */

            //set the modeName you want
            const chatModelName = "gpt-4";
            const embeddingModelName = "text-embedding-ada-002";

            console.log(`Leveraing the following LLMs \n Chat Model:  gpt-4 \n Embedding Model: text-embedding-ada-002\n`);
            //Optional. handle memory before the RAG LLM call
            const memoryContext = await storeRetrieveMessages(conversationId, messageId, message_time, user_id, user_query, Conversation, Message, chatModelName);

            //Obtain the model configs configured in package.json
            const chatModelConfig = cds.env.requires["GENERATIVE_AI_HUB"][chatModelName];
            const embeddingModelConfig = cds.env.requires["GENERATIVE_AI_HUB"][embeddingModelName];
            
            /*Some models require you to pass few mandatory chat params, please check the respective model documentation to pass those params in the 'charParams' parameter. 
            For example, AWS anthropic models requires few mandatory parameters such as anthropic_version and max_tokens, the you will need to pass those parameters in the 'chatParams' parameter of getRagResponseWithConfig(). 
            */

            /*Single method to perform the following :
            - Embed the input query
            - Perform similarity search based on the user query 
            - Construct the prompt based on the system instruction and similarity search
            - Call chat completion model to retrieve relevant answer to the user query
            */
            console.log("Getting the RAG retrival response from the CAP LLM Plugin!");

            const chatRagResponse = await capllmplugin.getRagResponseWithConfig(
                user_query, //user query
                tableName,   //table name containing the embeddings
                embeddingColumn, //column in the table containing the vector embeddings
                contentColumn, //  column in the table containing the actual content
                ragPrompt, // system prompt for the task
                embeddingModelConfig, //embedding model config
                chatModelConfig, //chat model config
                memoryContext.length > 0 ? memoryContext : undefined, //Optional.conversation memory context to be used.
                5  //Optional. topK similarity search results to be fetched. Defaults to 5
            );

            //parse the response object according to the respective model for your use case. For instance, lets consider the following three models.
            let chatCompletionResponse = null;
            if (chatModelName === "gpt-4"){
                chatCompletionResponse =
                {
                    "role": chatRagResponse.completion.choices[0].message.role,
                    "content": chatRagResponse.completion.choices[0].message.content
                }
            }
            //Optional. parse other model outputs if you choose to use a different model.
            else
            {
                throw new Error("The model supported in this application is 'gpt-4'. Please customize this application to use any model supported by CAP LLM Plugin. Please make the customization by referring to the comments.")
            }
            //Optional. handle memory after the RAG LLM call
            const responseTimestamp = new Date().toISOString();
            await storeModelResponse(conversationId, responseTimestamp, chatCompletionResponse, Message, Conversation);

            //build the response payload for the frontend.
            const response = {
                "role": chatCompletionResponse.role,
                "content": chatCompletionResponse.content,
                "messageTime": responseTimestamp,
                
            };
            console.log(response)

            return response;
        }
        catch (error) {
            // Handle any errors that occur during the execution
            console.log('Error while generating response for user query:', error);
            throw error;
        }
    })
    this.on('getRagResponse', async (req) => {
        try {
            const question = req.data.question || " "
            const vectorplugin = await cds.connect.to('cap-llm-plugin')


            const chatModelName = "gpt-4";
            const embeddingModelName = "text-embedding-ada-002";
            const embeddingModelConfig = cds.env.requires["GENERATIVE_AI_HUB"][embeddingModelName];
            const chatModelConfig = cds.env.requires["GENERATIVE_AI_HUB"][chatModelName];
            // const embeddingResult = await capllmplugin.getEmbeddingWithConfig(embeddingModelConfig, user_query);
            // const embedding = embeddingResult?.data[0]?.embedding;


            const chatRagResponse = await vectorplugin.getRagResponseWithConfig(
                question,  //user query
                tableName,   //table name containing the embeddings
                embeddingColumn, //column in the table containing the vector embeddings
                contentColumn, //  column in the table containing the actual content
                ragPrompt, // system prompt for the task
                embeddingModelConfig, //embedding model config
                chatModelConfig, //chat model config
            );

            let chatCompletionResponse = null;
            if (chatModelName === "gpt-4") {
                chatCompletionResponse =
                {
                    "role": chatRagResponse.completion.choices[0].message.role,
                    "content": chatRagResponse.completion.choices[0].message.content
                }
            }
            //Optional. parse other model outputs if you choose to use a different model.
            else {
                throw new Error("The model supported in this application is 'gpt-4'. Please customize this application to use any model supported by CAP LLM Plugin. Please make the customization by referring to the comments.")
            }
            //Optional. handle memory after the RAG LLM call
            // const responseTimestamp = new Date().toISOString();
            // await storeModelResponse(conversationId, responseTimestamp, chatCompletionResponse, Message, Conversation);

            //build the r esponse payload for the frontend.
            const response = {
                "role": chatCompletionResponse.role,
                "content": chatCompletionResponse.content,
                // "additionalContents": chatRagResponse.additionalContents,
            };

            return response;

            // const ragResponse = await vectorplugin.getRagResponse(
            //     altUserQuery,
            //     tableName,
            //     embeddingColumn,
            //     contentColumn
            // )
            // return chatRagResponse
        } catch (error) {
            console.log('Error while generating response for user query:', error)
            throw error;
        }
    })

    this.on('executeSimilaritySearch', async () => {
        const vectorplugin = await cds.connect.to('cap-llm-plugin')
        const embeddings = await vectorplugin.getEmbedding(userQuery)
        const similaritySearchResults = await vectorplugin.similaritySearch(
            tableName,
            embeddingColumn,
            contentColumn,
            embeddings,
            'L2DISTANCE',
            3
        )
        return similaritySearchResults
    })
    this.on('deleteChatData', async () => {
        try {
            const { Conversation, Message } = this.entities;
            await DELETE.from(Conversation);
            await DELETE.from(Message);
            return "Success!"
        }
        catch (error) {
            // Handle any errors that occur during the execution
            console.log('Error while deleting the chat content in db:', error);
            throw error;
        }
    })
}