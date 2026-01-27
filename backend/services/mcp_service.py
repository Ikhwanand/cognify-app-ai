"""
MCP Service
Service for managing MCP (Model Context Protocol) server connections
"""

import asyncio
import json
import time
from typing import Optional, List, Dict
from datetime import datetime


from sqlmodel import Session, select
from database import engine

from models.mcp_server import MCPServer, MCPServerStatus, MCPTransportType
from schemas.mcp import (
    MCPServerCreate,
    MCPServerUpdate,
    MCPToolInfo,
    MCPConnectionTestResult,
)

# Import Agno MCP Tools
try:
    from agno.tools.mcp import MCPTools

    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    print("Warning: agno.tools.mcp not available. MCP features will be limited.")


class MCPService:
    """Service for managing MCP server configurations and connections"""

    def __init__(self):
        self._active_connections: Dict[int, MCPTools] = {}

    # CRUD Operations
    def create_server(self, server_data: MCPServerCreate) -> MCPServer:
        """Create a new MCP server configuration"""
        with Session(engine) as session:
            # Check if server with same name exists
            existing = session.exec(
                select(MCPServer).where(MCPServer.name == server_data.name)
            ).first()
            if existing:
                raise ValueError(
                    f"MCP server with name '{server_data.name}' already exists"
                )

            server = MCPServer(
                name=server_data.name,
                description=server_data.description,
                transport_type=server_data.transport_type.value,
                command=server_data.command,
                url=server_data.url,
                api_key=server_data.api_key,
                is_enabled=server_data.is_enabled,
                status=MCPServerStatus.INACTIVE.value,
            )
            session.add(server)
            session.commit()
            session.refresh(server)
            return server

    def get_server(self, server_id: int) -> Optional[MCPServer]:
        """Get a single MCP server by ID"""
        with Session(engine) as session:
            return session.get(MCPServer, server_id)

    def get_server_by_name(self, name: str) -> Optional[MCPServer]:
        """Get a single MCP server by name"""
        with Session(engine) as session:
            return session.exec(select(MCPServer).where(MCPServer.name == name)).first()

    def get_all_servers(self, enabled_only: bool = False) -> List[MCPServer]:
        """Get all MCP server configurations"""
        with Session(engine) as session:
            query = select(MCPServer)
            if enabled_only:
                query = query.where(MCPServer.is_enabled.is_(True))
            return list(session.exec(query).all())

    def update_server(
        self, server_id: int, update_data: MCPServerUpdate
    ) -> Optional[MCPServer]:
        """Update an MCP server configuration"""
        with Session(engine) as session:
            server = session.get(MCPServer, server_id)
            if not server:
                return None

            update_dict = update_data.model_dump(exclude_unset=True)

            # Convert transport_type enum to string if present
            if "transport_type" in update_dict and update_dict["transport_type"]:
                update_dict["transport_type"] = update_dict["transport_type"].value

            for key, value in update_dict.items():
                setattr(server, key, value)

            server.updated_at = datetime.utcnow()
            session.add(server)
            session.commit()
            session.refresh(server)
            return server

    def delete_server(self, server_id: int) -> bool:
        """Delete an MCP server configuration"""
        with Session(engine) as session:
            server = session.get(MCPServer, server_id)
            if not server:
                return False

            # Close any active connection first
            if server_id in self._active_connections:
                asyncio.create_task(self._close_connection(server_id))

            session.delete(server)
            session.commit()
            return True

    # Connection Management
    async def test_connection(self, server_id: int) -> MCPConnectionTestResult:
        """Test connection to an MCP server"""
        if not MCP_AVAILABLE:
            return MCPConnectionTestResult(
                success=False,
                message="MCP tools not available. Please install agno with MCP support.",
            )

        with Session(engine) as session:
            server = session.get(MCPServer, server_id)
            if not server:
                return MCPConnectionTestResult(
                    success=False, message=f"MCP server with ID {server_id} not found"
                )

            try:
                start_time = time.time()
                mcp_tools = self._create_mcp_tools(server)

                await mcp_tools.connect()

                # Get available tools
                tools = []
                if hasattr(mcp_tools, "tools") and mcp_tools.tools:
                    for tool in mcp_tools.tools:
                        tool_name = getattr(tool, "name", str(tool))
                        tool_desc = getattr(tool, "description", None)
                        tools.append(MCPToolInfo(name=tool_name, description=tool_desc))

                await mcp_tools.close()

                latency_ms = (time.time() - start_time) * 1000

                # Update server status
                server.status = MCPServerStatus.ACTIVE.value
                server.last_connected_at = datetime.utcnow()
                server.error_message = None
                server.available_tools = json.dumps([t.model_dump() for t in tools])
                session.add(server)
                session.commit()

                return MCPConnectionTestResult(
                    success=True,
                    message=f"Successfully connected to MCP server '{server.name}'",
                    tools=tools,
                    latency_ms=latency_ms,
                )

            except Exception as e:
                # Update server status to error
                server.status = MCPServerStatus.ERROR.value
                server.error_message = str(e)
                session.add(server)
                session.commit()

                return MCPConnectionTestResult(
                    success=False, message=f"Failed to connect: {str(e)}"
                )

    async def connect_server(self, server_id: int) -> bool:
        """Establish a persistent connection to an MCP server"""
        if not MCP_AVAILABLE:
            return False

        if server_id in self._active_connections:
            return True  # Already connected

        with Session(engine) as session:
            server = session.get(MCPServer, server_id)
            if not server or not server.is_enabled:
                return False

            try:
                mcp_tools = self._create_mcp_tools(server)
                await mcp_tools.connect()

                self._active_connections[server_id] = mcp_tools

                server.status = MCPServerStatus.ACTIVE.value
                server.last_connected_at = datetime.utcnow()
                server.error_message = None
                session.add(server)
                session.commit()

                return True

            except Exception as e:
                server.status = MCPServerStatus.ERROR.value
                server.error_message = str(e)
                session.add(server)
                session.commit()
                return False

    async def disconnect_server(self, server_id: int) -> bool:
        """Disconnect from an MCP server"""
        if server_id not in self._active_connections:
            return True

        return await self._close_connection(server_id)

    async def _close_connection(self, server_id: int) -> bool:
        """Close an active MCP connection"""
        if server_id not in self._active_connections:
            return True

        try:
            mcp_tools = self._active_connections.pop(server_id)
            await mcp_tools.close()

            with Session(engine) as session:
                server = session.get(MCPServer, server_id)
                if server:
                    server.status = MCPServerStatus.INACTIVE.value
                    session.add(server)
                    session.commit()

            return True
        except Exception:
            return False

    def get_active_connections(self) -> Dict[int, MCPTools]:
        """Get all active MCP connections"""
        return self._active_connections

    def get_mcp_tools_for_agent(self) -> List[MCPTools]:
        """Get list of active MCPTools instances for use with agents"""
        return list(self._active_connections.values())

    def _create_mcp_tools(self, server: MCPServer) -> MCPTools:
        """Create MCPTools instance from server configuration"""
        if server.transport_type == MCPTransportType.COMMAND.value:
            if not server.command:
                raise ValueError("Command is required for command transport type")
            return MCPTools(command=server.command)
        else:
            if not server.url:
                raise ValueError("URL is required for HTTP/SSE transport type")
            return MCPTools(transport=server.transport_type, url=server.url)

    # Statistics
    def get_stats(self) -> Dict[str, int]:
        """Get statistics about MCP servers"""
        with Session(engine) as session:
            all_servers = list(session.exec(select(MCPServer)).all())

            stats = {
                "total_servers": len(all_servers),
                "active_servers": sum(
                    1 for s in all_servers if s.status == MCPServerStatus.ACTIVE.value
                ),
                "inactive_servers": sum(
                    1 for s in all_servers if s.status == MCPServerStatus.INACTIVE.value
                ),
                "error_servers": sum(
                    1 for s in all_servers if s.status == MCPServerStatus.ERROR.value
                ),
                "enabled_servers": sum(1 for s in all_servers if s.is_enabled),
                "disabled_servers": sum(1 for s in all_servers if not s.is_enabled),
            }
            return stats


# Singleton instance
mcp_service = MCPService()
