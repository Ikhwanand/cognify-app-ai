"""
MCP Server API Routes
Endpoints for managing MCP (Model Context Protocol) server configurations
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
import json

from schemas.mcp import (
    MCPServerCreate,
    MCPServerUpdate,
    MCPServerResponse,
    MCPServerListResponse,
    MCPConnectionTestResult,
    MCPServerStatsResponse,
    MCPToolInfo,
)
from services.mcp_service import mcp_service

router = APIRouter(prefix="/api/mcp", tags=["MCP Servers"])


def _convert_to_response(server) -> MCPServerResponse:
    """Convert MCPServer model to response schema"""
    tools = None
    if server.available_tools:
        try:
            tools_data = json.loads(server.available_tools)
            tools = [MCPToolInfo(**t) for t in tools_data]
        except (json.JSONDecodeError, TypeError):
            pass

    return MCPServerResponse(
        id=server.id,
        name=server.name,
        description=server.description,
        transport_type=server.transport_type,
        command=server.command,
        url=server.url,
        status=server.status,
        is_enabled=server.is_enabled,
        created_at=server.created_at,
        updated_at=server.updated_at,
        last_connected_at=server.last_connected_at,
        error_message=server.error_message,
        available_tools=tools,
    )


@router.get("/servers", response_model=MCPServerListResponse)
async def list_mcp_servers(enabled_only: bool = False):
    """
    Get all MCP server configurations.

    - **enabled_only**: If true, only return enabled servers
    """
    servers = mcp_service.get_all_servers(enabled_only=enabled_only)
    return MCPServerListResponse(
        servers=[_convert_to_response(s) for s in servers], total=len(servers)
    )


@router.post(
    "/servers", response_model=MCPServerResponse, status_code=status.HTTP_201_CREATED
)
async def create_mcp_server(server_data: MCPServerCreate):
    """
    Create a new MCP server configuration.

    Example configurations:
    - **Filesystem**: `command: "npx -y @modelcontextprotocol/server-filesystem C:/MyProject"`
    - **Git**: `command: "uvx mcp-server-github"`
    - **Remote**: `transport_type: "streamable-http", url: "https://example.com/mcp"`
    """
    # Validate based on transport type
    if server_data.transport_type.value == "command" and not server_data.command:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Command is required for 'command' transport type",
        )
    if (
        server_data.transport_type.value in ["streamable-http", "sse"]
        and not server_data.url
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL is required for HTTP/SSE transport type",
        )

    try:
        server = mcp_service.create_server(server_data)
        return _convert_to_response(server)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e


@router.get("/servers/{server_id}", response_model=MCPServerResponse)
async def get_mcp_server(server_id: int):
    """Get a single MCP server configuration by ID."""
    server = mcp_service.get_server(server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with ID {server_id} not found",
        )
    return _convert_to_response(server)


@router.put("/servers/{server_id}", response_model=MCPServerResponse)
async def update_mcp_server(server_id: int, update_data: MCPServerUpdate):
    """Update an existing MCP server configuration."""
    server = mcp_service.update_server(server_id, update_data)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with ID {server_id} not found",
        )
    return _convert_to_response(server)


@router.delete("/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mcp_server(server_id: int):
    """Delete an MCP server configuration."""
    if not mcp_service.delete_server(server_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server with ID {server_id} not found",
        )


@router.post("/servers/{server_id}/test", response_model=MCPConnectionTestResult)
async def test_mcp_connection(server_id: int):
    """
    Test connection to an MCP server.

    This will attempt to connect to the MCP server and retrieve the list of available tools.
    """
    result = await mcp_service.test_connection(server_id)
    return result


@router.post("/servers/{server_id}/connect")
async def connect_mcp_server(server_id: int):
    """
    Establish a persistent connection to an MCP server.

    Use this to keep an MCP server connected for use with agents.
    """
    success = await mcp_service.connect_server(server_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to connect to MCP server",
        )
    return {"message": f"Successfully connected to MCP server {server_id}"}


@router.post("/servers/{server_id}/disconnect")
async def disconnect_mcp_server(server_id: int):
    """Disconnect from an MCP server."""
    success = await mcp_service.disconnect_server(server_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect from MCP server",
        )
    return {"message": f"Disconnected from MCP server {server_id}"}


@router.get("/active", response_model=List[int])
async def get_active_connections():
    """Get list of currently connected MCP server IDs."""
    connections = mcp_service.get_active_connections()
    return list(connections.keys())


@router.get("/stats", response_model=MCPServerStatsResponse)
async def get_mcp_stats():
    """Get statistics about MCP servers."""
    stats = mcp_service.get_stats()
    return MCPServerStatsResponse(**stats)


# Preset MCP Servers
PRESET_SERVERS = [
    {
        "name": "filesystem",
        "description": "Access files and directories on the local filesystem",
        "transport_type": "command",
        "command_template": "npx -y @modelcontextprotocol/server-filesystem {path}",
    },
    {
        "name": "github",
        "description": "Interact with GitHub repositories",
        "transport_type": "command",
        "command_template": "uvx mcp-server-github",
    },
    {
        "name": "git",
        "description": "Interact with local Git repositories",
        "transport_type": "command",
        "command_template": "uvx mcp-server-git",
    },
    {
        "name": "sqlite",
        "description": "Query SQLite databases",
        "transport_type": "command",
        "command_template": "uvx mcp-server-sqlite --db-path {db_path}",
    },
    {
        "name": "postgres",
        "description": "Query PostgreSQL databases",
        "transport_type": "command",
        "command_template": "npx -y @modelcontextprotocol/server-postgres {connection_string}",
    },
    {
        "name": "slack",
        "description": "Interact with Slack workspaces",
        "transport_type": "command",
        "command_template": "uvx mcp-server-slack",
    },
    {
        "name": "brave-search",
        "description": "Search the web using Brave Search",
        "transport_type": "command",
        "command_template": "npx -y @anthropic-ai/brave-search-mcp-server",
    },
    {
        "name": "memory",
        "description": "Persistent memory and knowledge storage",
        "transport_type": "command",
        "command_template": "npx -y @modelcontextprotocol/server-memory",
    },
    {
        "name": "agno-docs",
        "description": "Agno documentation MCP server",
        "transport_type": "streamable-http",
        "url": "https://docs.agno.com/mcp",
    },
]


@router.get("/presets")
async def get_preset_servers():
    """
    Get list of preset MCP server configurations.

    These are common MCP servers that can be quickly configured.
    """
    return {"presets": PRESET_SERVERS}
