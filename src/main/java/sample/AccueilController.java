package sample;

import client.ClientConnexion;
import client.ServerPoller;
import javafx.application.Platform;
import javafx.application.Application;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.control.TextField;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.AnchorPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;

public class AccueilController {
    @FXML
    private SplitPane splitPane;
    @FXML
    private AnchorPane anchorUser;
    @FXML
    private AnchorPane anchorPlay;
    @FXML
    private Label labelBonjour;
    @FXML
    private VBox boxInfo;
    @FXML
    private Button playButton;
    @FXML
    private Button scoreButton;
    @FXML
    private Button disconnectButton;
    @FXML
    private Label playStatus;
    public static String numJoueur;

    @FXML
    public void disconnect() {
        ConnexionController.stageAccueil.hide();
        ConnexionController.primaryStage.show();
    }

    @FXML
    public void play() throws IOException {
        ArrayList<Object> connects = new ArrayList<>();
        connects.add("PLAYLOBBY");
        connects.add(ConnexionController.idUser);
        ClientConnexion client = new ClientConnexion(ConnexionController.host, ConnexionController.port, connects);
        ArrayList<Object> lobbyData = client.run();

        playStatus.setText("En attente de joueurs...");
        ArrayList<Object> waits = new ArrayList<>();
        waits.add("WAIT");
        ServerPoller poller = new ServerPoller();
        poller.poll(ConnexionController.host, ConnexionController.port, waits,
                resp -> ((int) resp.get(0) % 5) == 0,
                resp -> {
                    playStatus.setText("Début de la partie");
                    try {
                        startGame(lobbyData);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                });
    }

    private void startGame(ArrayList<Object> lobbyData) throws IOException {
        ArrayList<Object> plays = new ArrayList<>();
        plays.add("PLAY");
        plays.add(ConnexionController.idUser);
        plays.add(lobbyData.get(1));
        ClientConnexion client2 = new ClientConnexion(ConnexionController.host, ConnexionController.port, plays);
        ArrayList<Object> datas2 = client2.run();
        ArrayList<String> idCartes = (ArrayList<String>) datas2.get(0);
        ArrayList<String> lienCartes = (ArrayList<String>) datas2.get(1);
        numJoueur = (String) datas2.get(2);

        ConnexionController.stageAccueil.hide();
        FXMLLoader loader = new FXMLLoader(getClass().getResource("partie.fxml"));
        Parent root = loader.load();
        Stage gameStage = new Stage();
        Scene scene = new Scene(root, 900, 500);
        scene.getStylesheets().add(getClass().getResource("style.css").toString());
        gameStage.setResizable(false);
        gameStage.setTitle("Tarot en ligne");
        gameStage.setScene(scene);
        gameStage.show();

        HBox main = (HBox) root.lookup("#main");
        main.setSpacing(10);
        for (int i = 0; i < idCartes.size(); i++) {
            ImageView imageCarte = new ImageView(new Image("/sample/img/" + lienCartes.get(i), 40, 60, false, false));
            imageCarte.setId(idCartes.get(i));
            main.getChildren().add(imageCarte);
        }
    }
}
