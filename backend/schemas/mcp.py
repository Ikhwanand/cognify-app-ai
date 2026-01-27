"""
MCP Server Schemas
Request and Response schemas for MCP API endpoints
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MCPTransportType(str, Enum):
    """Transport types for MCP connections"""
    COMMAND = "command"
    HTTP = "streamable-http"
    SSE = "sse"


# Request Schemas
class MCPServerCreate(BaseModel):
    """Schema for creating a new MCP server configuration"""
    name: str = Field(..., min_length=1, max_length=100, description="Unique name for the MCP server")
    description: Optional[str] = Field(None, max_length=500, description="Description of what this server does")
    transport_type: MCPTransportType = Field(
        default=MCPTransportType.COMMAND,
        description="Transport type for the MCP connection"
    )
    command: Optional[str] = Field(
        None, 
        description="Command to start the MCP server (required for 'command' transport)"
    )
    url: Optional[str] = Field(
        None,
        description="URL for remote MCP server (required for 'streamable-http' or 'sse' transport)"
    )
    api_key: Optional[str] = Field(None, description="API key for authenticated MCP servers")
    is_enabled: bool = Field(default=True, description="Whether this server is enabled")

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "name": "filesystem",
                    "description": "Access to local filesystem for file operations",
                    "transport_type": "command",
                    "command": "npx -y @modelcontextprotocol/server-filesystem C:/MyProject",
                    "is_enabled": True
                },
                {
                    "name": "github",
                    "description": "Access to GitHub repositories",
                    "transport_type": "command",
                    "command": "uvx mcp-server-github",
                    "is_enabled": True
                },
                {
                    "name": "agno-docs",
                    "description": "Agno documentation MCP server",
                    "transport_type": "streamable-http",
                    "url": "https://docs.agno.com/mcp",
                    "is_enabled": True
                }
            ]
        }


class MCPServerUpdate(BaseModel):
    """Schema for updating an existing MCP server configuration"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    transport_type: Optional[MCPTransportType] = None
    command: Optional[str] = None
    url: Optional[str] = None
    api_key: Optional[str] = None
    is_enabled: Optional[bool] = None


# Response Schemas
class MCPToolInfo(BaseModel):
    """Information about a tool available from an MCP server"""
    name: str
    description: Optional[str] = None


class MCPServerResponse(BaseModel):
    """Response schema for MCP server details"""
    id: int
    name: str
    description: Optional[str]
    transport_type: str
    command: Optional[str]
    url: Optional[str]
    status: str
    is_enabled: bool
    created_at: datetime
    updated_at: datetime
    last_connected_at: Optional[datetime]
    error_message: Optional[str]
    available_tools: Optional[List[MCPToolInfo]] = None

    class Config:
        from_attributes = True


class MCPServerListResponse(BaseModel):
    """Response schema for list of MCP servers"""
    servers: List[MCPServerResponse]
    total: int


class MCPConnectionTestResult(BaseModel):
    """Result of testing an MCP server connection"""
    success: bool
    message: str
    tools: Optional[List[MCPToolInfo]] = None
    latency_ms: Optional[float] = None


class MCPServerStatsResponse(BaseModel):
    """Statistics about MCP servers"""
    total_servers: int
    active_servers: int
    inactive_servers: int
    error_servers: int
    enabled_servers: int
    disabled_servers: int
