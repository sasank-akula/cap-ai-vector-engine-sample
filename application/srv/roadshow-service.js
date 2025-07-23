const cds = require('@sap/cds')
const tableName = 'SAP_ADVOCATES_DEMO_DOCUMENTCHUNK'
const embeddingColumn = 'EMBEDDING'
const contentColumn = 'TEXT_CHUNK'
const userQuery = 'In which city are Thomas Jung and Rich Heilman on April, 19th 2024?'
const instructions = 'Return the result in json format. Display the keys, the topic and the city in a table form.'

const altUserQuery = 'Who is joining the event in Madrid Spain?'
const altInstructions = 'Return the result in json format. Display the name.'

const systemPrompt =
    ` You are an helpful assistant who answers user question based only on the following context enclosed in triple quotes.\n
`;

module.exports = function () {
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
                systemPrompt, // system prompt for the task
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

            //build the response payload for the frontend.
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
}