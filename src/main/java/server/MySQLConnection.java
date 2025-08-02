package server;

import java.sql.*;

public class MySQLConnection {

    private Connection connection;

    public MySQLConnection(String url, String user, String pass) throws SQLException, ClassNotFoundException {
        try {
            Class.forName("com.mysql.jdbc.Driver");
        }
        catch (ClassNotFoundException e) {
            System.out.println("Impossible de charger le driver com.mysql.jdbc.Driver");
            e.printStackTrace();
        }
        try {
            this.connection = DriverManager.getConnection(url,user,pass);
            System.out.println("Connexion établie avec la base de données");
        } catch (SQLException e) {
            System.out.println("Impossible d'accéder à la base de données");
        }
    }

    public static MySQLConnection fromEnv() throws SQLException, ClassNotFoundException {
        String url = System.getenv().getOrDefault("DB_URL", "jdbc:mysql://localhost:3306/tarot_project");
        String user = System.getenv().getOrDefault("DB_USER", "root");
        String pass = System.getenv().getOrDefault("DB_PASSWORD", "");
        return new MySQLConnection(url, user, pass);
    }

    public Connection getConnection() {
        return this.connection;
    }

    public static void main(String[]args) throws SQLException, ClassNotFoundException {
        MySQLConnection db = new MySQLConnection("jdbc:mysql://localhost:3306/projetTarot","root","");
        Connection conn = db.getConnection();
        Statement stmt = conn.createStatement();
        /**
         * Exemple de requête avec BD
         */
        ResultSet rs = stmt.executeQuery("SELECT * FROM user");
        rs.next();
        String pseudo = rs.getString(1);
        System.out.println(pseudo);
    }
}
