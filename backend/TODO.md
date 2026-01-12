# Phase 2: Chat Session Management.
### 1. Create Data Schemas (DTOs)

    [X] Create a new file app/schemas/chat.py.

    [X] Define ConversationCreate (Pydantic model) with a title field (optional/default).

    [X] Define ConversationRead (Pydantic model) including id, title, created_at, and updated_at.

### 2. Implement the Service Layer

    [X] Create a new file app/services/chat.py.

    [X] Create a ChatService class initialized with the database Session.

    [X] Implement create_conversation(user_id, data):

        Initialize a new Conversation model with the user's ID.

        Commit to DB and refresh.

    [X] Implement get_user_conversations(user_id, limit, offset):

        Write a SQLModel query selecting conversations where user_id matches.

        Add .order_by(Conversation.updated_at.desc()) so recent chats appear first.

    [] Implement get_conversation(conversation_id, user_id):

        Query for a specific ID and verify the user_id matches (security check).

### 3. Build the API Routes

    [ ] Create a new file app/api/routes/chat.py.

    [ ] Create a POST / endpoint to start a new chat (uses ChatService.create_conversation).

    [ ] Create a GET / endpoint to list history (uses ChatService.get_user_conversations).

    [ ] Create a GET /{conversation_id} endpoint to fetch details (uses ChatService.get_conversation).

        Tip: Raise a 404 HTTPException if the service returns None.

### 4. Wire It Up

    [ ] Open app/main.py.

    [ ] Import the new chat router.

    [ ] Include the router with the prefix /api/v1/chats and tag ["Chats"].