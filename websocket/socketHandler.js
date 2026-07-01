import jwt from "jsonwebtoken";
import User from "../models/User.js";

const connectedUsers = new Map();

export const setupSocketIO = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      
      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user._id}`);
    
    // Join user to their personal room
    socket.join(`user_${socket.user._id}`);
    
    // Join hospital room for broadcasts
    socket.join(`hospital_${socket.user.hospital}`);
    
    // Join role-based room
    socket.join(`role_${socket.user.role}`);

    // Track connected users
    connectedUsers.set(socket.user._id.toString(), {
      socketId: socket.id,
      userId: socket.user._id,
      role: socket.user.role,
      hospital: socket.user.hospital
    });

    // Emit connected users count to admins
    io.to("role_admin").emit("users_online", connectedUsers.size);

    // Handle joining specific monitor room
    socket.on("join_monitor", (monitorId) => {
      socket.join(`monitor_${monitorId}`);
      console.log(`User ${socket.user._id} joined monitor ${monitorId}`);
    });

    // Handle leaving monitor room
    socket.on("leave_monitor", (monitorId) => {
      socket.leave(`monitor_${monitorId}`);
    });

    // Handle real-time monitor updates
    socket.on("monitor_update", async (data) => {
      // Broadcast to all users in the monitor room
      io.to(`monitor_${data.monitorId}`).emit("monitor_data_updated", data);
    });

    // Handle acknowledgment of alerts
    socket.on("acknowledge_alert", (data) => {
      io.to(`monitor_${data.monitorId}`).emit("alert_acknowledged", {
        alertId: data.alertId,
        acknowledgedBy: socket.user.firstName + " " + socket.user.lastName,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.user._id}`);
      connectedUsers.delete(socket.user._id.toString());
      io.to("role_admin").emit("users_online", connectedUsers.size);
    });
  });

  // Function to emit real-time alert
  io.emitAlert = (alertData) => {
    io.to(`monitor_${alertData.monitorId}`).emit("new_alert", alertData);
    
    // Also emit to relevant roles based on severity
    if (alertData.severity === "critical") {
      io.to("role_doctor").emit("critical_alert", alertData);
      io.to("role_nurse").emit("critical_alert", alertData);
    }
  };

  // Function to emit IV level updates
  io.emitLevelUpdate = (monitorId, levelData) => {
    io.to(`monitor_${monitorId}`).emit("level_updated", levelData);
  };
};